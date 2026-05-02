import { PdfEngineError } from './pdf-engine-error';

export class PdfParseError extends PdfEngineError {
  constructor(message: string, code = 'PDF_PARSE_ERROR', cause?: Error) {
    super(message, code, cause);
    this.name = 'PdfParseError';
  }
}

export const createPdfParseError = (message: string, code?: string, cause?: Error) =>
  new PdfParseError(message, code, cause);
