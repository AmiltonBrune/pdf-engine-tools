import { PDFDocument } from 'pdf-lib';
import PDFParser from 'pdf2json';
import { PdfTextExtractor } from '../../core/contracts/pdf-text-extractor';
import { ExtractOptions, ExtractResult } from '../../core/types';

export class Pdf2JsonExtractor implements PdfTextExtractor {
  async extract(buffer: Uint8Array, options?: ExtractOptions): Promise<ExtractResult> {
    const nodeBuffer = Buffer.from(buffer);

    if (nodeBuffer.length === 0) {
      return { text: '', pageCount: 0, isCorrupted: true };
    }

    const header = nodeBuffer.toString('ascii', 0, 8);
    if (!header.startsWith('%PDF-')) {
      return { text: '', pageCount: 0, isCorrupted: true };
    }

    const pageLimit = options?.pageLimit;
    let processBuffer = nodeBuffer;
    let originalPageCount: number | undefined;
    let truncated = false;

    if (pageLimit && pageLimit > 0) {
      try {
        const pdfDoc = await PDFDocument.load(nodeBuffer);
        const totalPages = pdfDoc.getPageCount();

        if (totalPages > pageLimit) {
          originalPageCount = totalPages;
          truncated = true;
          const newPdf = await PDFDocument.create();
          const copiedPages = await newPdf.copyPages(pdfDoc, [...Array(pageLimit).keys()]);
          copiedPages.forEach((p) => newPdf.addPage(p));
          processBuffer = Buffer.from(await newPdf.save());
        }
      } catch {
        // fallback: process original buffer
      }
    }

    const result = await this.parseWithPdf2Json(processBuffer, originalPageCount, truncated);
    if (result.isCorrupted) {
      return this.extractPageByPage(processBuffer, originalPageCount, truncated);
    }
    return result;
  }

  private async extractPageByPage(
    buffer: Buffer,
    originalPageCount?: number,
    truncated = false
  ): Promise<ExtractResult> {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();
      let fullText = '';
      const errorPages: number[] = [];
      const allSignatureDates: string[] = [];
      let isSigned = false;

      for (let i = 0; i < totalPages; i++) {
        try {
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
          singlePageDoc.addPage(copiedPage);
          const singlePageBuffer = Buffer.from(await singlePageDoc.save());

          const pageResult = await this.parseWithPdf2Json(singlePageBuffer, 1, false);

          if (pageResult.isCorrupted) {
            errorPages.push(i + 1);
          } else {
            fullText += (fullText ? ' ' : '') + pageResult.text;
            if (pageResult.isSigned) isSigned = true;
            if (pageResult.signatureDates) {
              allSignatureDates.push(...pageResult.signatureDates);
            }
          }
        } catch {
          errorPages.push(i + 1);
        }
      }

      const isSignedWithin2Days = this.isSignedWithinNDays(allSignatureDates, 2);

      return {
        text: fullText.trim(),
        pageCount: totalPages,
        originalPageCount: originalPageCount ?? totalPages,
        truncated,
        isCorrupted: errorPages.length === totalPages && totalPages > 0,
        isSigned,
        isSignedWithin2Days,
        signatureDates: allSignatureDates,
        errorPages,
      };
    } catch {
      return { text: '', pageCount: 0, isCorrupted: true, originalPageCount, truncated };
    }
  }

  private parseWithPdf2Json(
    buffer: Buffer,
    originalPageCount?: number,
    truncated = false
  ): Promise<ExtractResult> {
    return new Promise((resolve) => {
      const parser = new PDFParser(null, false);
      let settled = false;

      const fail = () => {
        if (settled) return;
        settled = true;
        resolve({ text: '', pageCount: 0, isCorrupted: true, originalPageCount, truncated });
      };

      const timeout = setTimeout(fail, 60000);

      parser.on('pdfParser_dataReady', (data: any) => {
        if (settled) return;
        clearTimeout(timeout);
        try {
          const pages = data?.Pages || [];
          const text = this.extractText(parser, data);
          const pageCount = Array.isArray(pages) ? pages.length : 0;
          const signatureDates = this.extractSignatureDates(pages);
          const isSigned = this.hasSignature(pages, text);
          const isSignedWithin2Days = this.isSignedWithinNDays(signatureDates, 2);

          settled = true;
          resolve({
            text,
            pageCount,
            originalPageCount: originalPageCount ?? pageCount,
            truncated,
            isCorrupted: false,
            isSigned,
            isSignedWithin2Days,
            signatureDates,
            rawData: data,
          });
        } catch {
          fail();
        }
      });

      parser.on('pdfParser_dataError', () => { clearTimeout(timeout); fail(); });
      (parser as any).on('error', () => { clearTimeout(timeout); fail(); });

      try {
        parser.parseBuffer(buffer);
      } catch {
        clearTimeout(timeout);
        fail();
      }
    });
  }

  private extractText(pdfParser: any, data: any): string {
    const raw = pdfParser.getRawTextContent() || '';
    if (raw.length > 0) return raw;

    if (!Array.isArray(data?.Pages)) return '';

    const pages = data.Pages;
    const chunkSize = Math.ceil(pages.length / 4);
    const chunks: string[][] = [];

    for (let i = 0; i < pages.length; i += chunkSize) {
      const chunk = pages.slice(i, i + chunkSize);
      const chunkTexts: string[] = [];

      for (const page of chunk) {
        const texts = page?.Texts || [];
        if (texts.length === 0) continue;

        const parts = new Array(texts.length * 2);
        let idx = 0;

        for (const t of texts) {
          for (const r of t?.R || []) {
            const token = r?.T ?? '';
            if (typeof token !== 'string' || token.length === 0) continue;
            if (token.includes('%')) {
              try { parts[idx++] = decodeURIComponent(token); }
              catch { parts[idx++] = token; }
            } else {
              parts[idx++] = token;
            }
          }
        }

        if (idx > 0) chunkTexts.push(parts.slice(0, idx).join(''));
      }
      chunks.push(chunkTexts);
    }

    return chunks.flat().join(' ');
  }

  private extractSignatureDates(pages: any[]): string[] {
    const dates: string[] = [];
    for (const page of pages) {
      for (const field of page.Fields || []) {
        if (field.T?.Name === 'signature' && typeof field.Sig?.M === 'string') {
          const sigDate = field.Sig.M;
          if (sigDate.startsWith('D:')) {
            const d = sigDate.substring(2, 10);
            if (d.length === 8) {
              dates.push(`${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`);
            }
          }
          dates.push(sigDate.split('T')[0]);
        }
      }
    }
    return dates;
  }

  private hasSignature(pages: any[], text: string): boolean {
    const inFields = pages.some((page) =>
      (page.Fields || []).some(
        (f: any) =>
          f.T?.Name === 'signature' ||
          f.Sig?.M ||
          (typeof f.T?.Name === 'string' && f.T.Name.toLowerCase().includes('sign'))
      )
    );
    if (inFields) return true;

    const lower = (text || '').toLowerCase();
    return lower.includes('assinatura digital') || lower.includes('digitally signed') || lower.includes('signature');
  }

  private isSignedWithinNDays(dates: string[], days: number): boolean {
    if (!dates.length) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const minDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    return dates.some((ds) => { const d = new Date(ds); return d >= minDate && d <= now; });
  }
}
