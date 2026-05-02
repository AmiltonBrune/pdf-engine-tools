import { PdfParser } from '../contracts/pdf-parser';
import { createPdfParseError, PdfEngineError } from '../errors';

export class ParsePdfTask {
  constructor(private readonly parser: PdfParser) {}

  async execute(buffer: Uint8Array): Promise<number> {
    try {
      if (buffer.length === 0) {
        throw createPdfParseError('Buffer do PDF está vazio');
      }
      return await this.parser.getPageCount(buffer);
    } catch (error: any) {
      if (error instanceof PdfEngineError) throw error;
      throw createPdfParseError(
        `Erro ao contar páginas: ${error?.message || 'Erro desconhecido'}`,
        undefined,
        error
      );
    }
  }
}
