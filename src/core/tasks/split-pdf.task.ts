import { PdfSplitter } from '../contracts/pdf-splitter';
import { createPdfParseError, PdfEngineError } from '../errors';
import { SplitChunkResult, SplitOptions } from '../types';

export class SplitPdfTask {
  constructor(private readonly splitter: PdfSplitter) {}

  async execute(buffer: Uint8Array, options: SplitOptions): Promise<SplitChunkResult> {
    try {
      if (buffer.length === 0) {
        throw createPdfParseError('Buffer do PDF está vazio', 'PDF_SPLIT_ERROR');
      }
      return await this.splitter.split(buffer, options);
    } catch (error: any) {
      if (error instanceof PdfEngineError) throw error;
      throw createPdfParseError(
        `Erro ao dividir PDF: ${error?.message || 'Erro desconhecido'}`,
        'PDF_SPLIT_ERROR',
        error
      );
    }
  }
}
