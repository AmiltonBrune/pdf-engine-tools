import { ExtractTextTask } from '../../src/core/tasks/extract-text.task';
import { PdfParseError } from '../../src/core/errors';
import { PdfTextExtractor } from '../../src/core/contracts/pdf-text-extractor';
import { ExtractResult } from '../../src/core/types';

describe('ExtractTextTask', () => {
  const mockExtractor: PdfTextExtractor = { extract: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  const fakeResult: ExtractResult = {
    text: 'conteúdo extraído',
    pageCount: 5,
    isCorrupted: false,
    isSigned: false,
  };

  it('deve delegar extração para o contrato', async () => {
    (mockExtractor.extract as jest.Mock).mockResolvedValue(fakeResult);
    const task = new ExtractTextTask(mockExtractor);
    const result = await task.execute(new Uint8Array([1, 2]), { pageLimit: 10 });

    expect(result).toEqual(fakeResult);
    expect(mockExtractor.extract).toHaveBeenCalledWith(new Uint8Array([1, 2]), { pageLimit: 10 });
  });

  it('deve lançar PdfParseError para buffer vazio', async () => {
    const task = new ExtractTextTask(mockExtractor);
    await expect(task.execute(new Uint8Array([]))).rejects.toThrow(PdfParseError);
  });

  it('deve propagar PdfParseError do extractor', async () => {
    const original = new PdfParseError('corrompido');
    (mockExtractor.extract as jest.Mock).mockRejectedValue(original);

    const task = new ExtractTextTask(mockExtractor);
    await expect(task.execute(new Uint8Array([1]))).rejects.toBe(original);
  });

  it('deve encapsular erros genéricos', async () => {
    (mockExtractor.extract as jest.Mock).mockRejectedValue(new Error('io fail'));

    const task = new ExtractTextTask(mockExtractor);
    await expect(task.execute(new Uint8Array([1]))).rejects.toThrow('Erro ao extrair texto: io fail');
  });

  it('deve funcionar sem options', async () => {
    (mockExtractor.extract as jest.Mock).mockResolvedValue(fakeResult);
    const task = new ExtractTextTask(mockExtractor);
    const result = await task.execute(new Uint8Array([1]));
    expect(result).toEqual(fakeResult);
  });
});
