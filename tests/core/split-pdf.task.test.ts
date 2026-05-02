import { SplitPdfTask } from '../../src/core/tasks/split-pdf.task';
import { PdfParseError } from '../../src/core/errors';
import { PdfSplitter } from '../../src/core/contracts/pdf-splitter';
import { SplitChunkResult } from '../../src/core/types';

describe('SplitPdfTask', () => {
  const mockSplitter: PdfSplitter = { split: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  const fakeSplit: SplitChunkResult = {
    chunks: [new Uint8Array([1]), new Uint8Array([2])],
    totalParts: 2,
    originalPageCount: 20,
  };

  it('deve delegar split para o contrato', async () => {
    (mockSplitter.split as jest.Mock).mockResolvedValue(fakeSplit);
    const task = new SplitPdfTask(mockSplitter);
    const result = await task.execute(new Uint8Array([1]), { chunkSize: 10 });

    expect(result).toEqual(fakeSplit);
    expect(mockSplitter.split).toHaveBeenCalledWith(new Uint8Array([1]), { chunkSize: 10 });
  });

  it('deve lançar PdfParseError com code PDF_SPLIT_ERROR para buffer vazio', async () => {
    const task = new SplitPdfTask(mockSplitter);
    try {
      await task.execute(new Uint8Array([]), { chunkSize: 10 });
      fail('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(PdfParseError);
      expect((error as PdfParseError).code).toBe('PDF_SPLIT_ERROR');
    }
  });

  it('deve propagar PdfParseError do splitter', async () => {
    const original = new PdfParseError('splitter falhou', 'PDF_SPLIT_ERROR');
    (mockSplitter.split as jest.Mock).mockRejectedValue(original);

    const task = new SplitPdfTask(mockSplitter);
    await expect(task.execute(new Uint8Array([1]), { chunkSize: 5 })).rejects.toBe(original);
  });

  it('deve encapsular erros genéricos com code PDF_SPLIT_ERROR', async () => {
    (mockSplitter.split as jest.Mock).mockRejectedValue(new Error('disk full'));

    const task = new SplitPdfTask(mockSplitter);
    try {
      await task.execute(new Uint8Array([1]), { chunkSize: 5 });
      fail('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(PdfParseError);
      expect((error as PdfParseError).code).toBe('PDF_SPLIT_ERROR');
      expect((error as PdfParseError).message).toContain('disk full');
    }
  });
});
