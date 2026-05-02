import { PdfEngineError } from './pdf-engine-error';

export class PdfWorkerError extends PdfEngineError {
  constructor(message: string, cause?: Error) {
    super(message, 'WORKER_ERROR', cause);
    this.name = 'PdfWorkerError';
  }
}

export const createPdfWorkerError = (message: string, cause?: Error) =>
  new PdfWorkerError(message, cause);
