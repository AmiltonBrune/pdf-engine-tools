import { PDFDocument } from 'pdf-lib';
import { PdfSplitter } from '../../core/contracts/pdf-splitter';
import { SplitChunkResult, SplitOptions } from '../../core/types';

export class PdfLibSplitter implements PdfSplitter {
  async split(buffer: Uint8Array, options: SplitOptions): Promise<SplitChunkResult> {
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    const { chunkSize } = options;
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < totalPages; i += chunkSize) {
      const newPdf = await PDFDocument.create();
      const endPage = Math.min(i + chunkSize, totalPages);
      const pageIndices = [...Array(endPage - i).keys()].map((n) => n + i);
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));
      chunks.push(new Uint8Array(await newPdf.save()));
    }

    return { chunks, totalParts: chunks.length, originalPageCount: totalPages };
  }
}
