import { PdfEngineError } from '../../src/core/errors/pdf-engine-error';
import { PdfParseError, createPdfParseError } from '../../src/core/errors/pdf-parse-error';
import { PdfWorkerError, createPdfWorkerError } from '../../src/core/errors/pdf-worker-error';

describe('PdfEngineError', () => {
  it('deve criar erro com message, code e cause', () => {
    const cause = new Error('causa raiz');
    const error = new PdfEngineError('falhou', 'TEST_ERROR', cause);

    expect(error.message).toBe('falhou');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('PdfEngineError');
    expect(error).toBeInstanceOf(Error);
  });

  it('deve criar erro sem cause', () => {
    const error = new PdfEngineError('sem causa', 'NO_CAUSE');
    expect(error.cause).toBeUndefined();
  });
});

describe('PdfParseError', () => {
  it('deve herdar de PdfEngineError', () => {
    const error = new PdfParseError('parse falhou');
    expect(error).toBeInstanceOf(PdfEngineError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PdfParseError');
  });

  it('deve usar código padrão PDF_PARSE_ERROR', () => {
    const error = new PdfParseError('falhou');
    expect(error.code).toBe('PDF_PARSE_ERROR');
  });

  it('deve aceitar código customizado', () => {
    const error = new PdfParseError('falhou', 'PDF_SPLIT_ERROR');
    expect(error.code).toBe('PDF_SPLIT_ERROR');
  });

  it('deve aceitar cause', () => {
    const cause = new Error('original');
    const error = new PdfParseError('falhou', 'PDF_PARSE_ERROR', cause);
    expect(error.cause).toBe(cause);
  });

  it('createPdfParseError deve criar instância correta', () => {
    const error = createPdfParseError('teste');
    expect(error).toBeInstanceOf(PdfParseError);
    expect(error.message).toBe('teste');
  });

  it('createPdfParseError deve aceitar code e cause', () => {
    const cause = new Error('orig');
    const error = createPdfParseError('teste', 'TIMEOUT_ERROR', cause);
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.cause).toBe(cause);
  });
});

describe('PdfWorkerError', () => {
  it('deve herdar de PdfEngineError com código WORKER_ERROR', () => {
    const error = new PdfWorkerError('worker falhou');
    expect(error).toBeInstanceOf(PdfEngineError);
    expect(error.code).toBe('WORKER_ERROR');
    expect(error.name).toBe('PdfWorkerError');
  });

  it('deve aceitar cause', () => {
    const cause = new Error('thread crash');
    const error = new PdfWorkerError('worker falhou', cause);
    expect(error.cause).toBe(cause);
  });

  it('createPdfWorkerError deve criar instância correta', () => {
    const error = createPdfWorkerError('pool cheio');
    expect(error).toBeInstanceOf(PdfWorkerError);
    expect(error.message).toBe('pool cheio');
  });

  it('createPdfWorkerError deve aceitar cause', () => {
    const cause = new Error('timeout');
    const error = createPdfWorkerError('falhou', cause);
    expect(error.cause).toBe(cause);
  });
});
