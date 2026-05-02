import { PdfTextExtractor } from '../contracts/pdf-text-extractor';
import { createPdfParseError, PdfEngineError } from '../errors';
import { ExtractOptions, ExtractResult } from '../types';

export class ExtractTextTask {
  constructor(private readonly extractor: PdfTextExtractor) {}

  async execute(buffer: Uint8Array, options?: ExtractOptions): Promise<ExtractResult> {
    try {
      if (buffer.length === 0) {
        throw createPdfParseError('Buffer do PDF está vazio');
      }
      return await this.extractor.extract(buffer, options);
    } catch (error: any) {
      if (error instanceof PdfEngineError) throw error;
      throw createPdfParseError(
        `Erro ao extrair texto: ${error?.message || 'Erro desconhecido'}`,
        undefined,
        error
      );
    }
  }
}
