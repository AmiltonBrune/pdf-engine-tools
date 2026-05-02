import { PdfTextExtractor } from '../contracts/pdf-text-extractor';
import { createPdfParseError, PdfEngineError } from '../errors';
import { PdfProcessingConfig, PdfProcessingResult } from '../types';

export class PdfPipeline {
  constructor(private readonly extractor: PdfTextExtractor) {}

  async process(buffer: Uint8Array, config: PdfProcessingConfig): Promise<PdfProcessingResult> {
    try {
      if (buffer.length === 0) {
        throw createPdfParseError('Buffer do PDF está vazio');
      }

      const result = await this.extractor.extract(buffer, {
        pageLimit: config.enablePageLimit !== false ? config.pageLimit : undefined,
      });

      return {
        success: true,
        text: result.text,
        pageCount: result.pageCount,
        originalPageCount: result.originalPageCount,
        truncated: result.truncated,
        isCorrupted: result.isCorrupted,
        isSigned: result.isSigned,
        isSignedWithin2Days: result.isSignedWithin2Days,
        signatureDates: result.signatureDates,
        rawData: result.rawData,
        errorPages: result.errorPages,
      };
    } catch (error: any) {
      if (error instanceof PdfEngineError) throw error;
      throw createPdfParseError(
        `Erro no pipeline: ${error?.message || 'Erro desconhecido'}`,
        undefined,
        error
      );
    }
  }

  processMultiple(results: PdfProcessingResult[]): PdfProcessingResult {
    if (results.length === 0) {
      throw createPdfParseError('Nenhum resultado para combinar', 'PDF_MERGE_ERROR');
    }

    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      return {
        success: false,
        text: '',
        pageCount: 0,
        error: results.map((r) => r.error).filter(Boolean).join('; ') || 'Todos os resultados falharam',
      };
    }

    const successful = results.filter((r) => r.success);
    if (successful.length === 1) return successful[0]!;

    const allDates = successful
      .flatMap((r) => r.signatureDates || [])
      .filter((d, i, arr) => arr.indexOf(d) === i);

    return {
      success: true,
      text: successful.map((r) => r.text).filter((t) => t?.trim()).join('\n\n'),
      pageCount: successful.reduce((sum, r) => sum + (r.pageCount || 0), 0),
      rawData: successful[0]?.rawData,
      originalPageCount: successful.reduce((sum, r) => sum + (r.originalPageCount || r.pageCount), 0),
      truncated: successful.some((r) => r.truncated),
      isCorrupted: successful.some((r) => r.isCorrupted),
      isSigned: successful.some((r) => r.isSigned),
      isSignedWithin2Days: successful.some((r) => r.isSignedWithin2Days),
      signatureDates: allDates,
      errorPages: successful.flatMap((r) => r.errorPages || []),
    };
  }

  shouldProcessInChunks(pageCount: number, config: PdfProcessingConfig): boolean {
    return config.enablePageLimit !== false && (config.pageLimit || 12) < pageCount;
  }
}
