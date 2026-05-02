import { ParsePdfTask } from '../../src/core/tasks/parse-pdf.task';
import { PdfParseError } from '../../src/core/errors';
import { PdfParser } from '../../src/core/contracts/pdf-parser';

describe('ParsePdfTask', () => {
  const mockParser: PdfParser = { getPageCount: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('deve retornar page count do parser', async () => {
    (mockParser.getPageCount as jest.Mock).mockResolvedValue(25);

    const task = new ParsePdfTask(mockParser);
    const result = await task.execute(new Uint8Array([1, 2, 3]));

    expect(result).toBe(25);
    expect(mockParser.getPageCount).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  });

  it('deve lançar PdfParseError para buffer vazio', async () => {
    const task = new ParsePdfTask(mockParser);
    await expect(task.execute(new Uint8Array([]))).rejects.toThrow(PdfParseError);
    await expect(task.execute(new Uint8Array([]))).rejects.toThrow('Buffer do PDF está vazio');
  });

  it('deve propagar PdfParseError do parser sem encapsular', async () => {
    const original = new PdfParseError('parser quebrou');
    (mockParser.getPageCount as jest.Mock).mockRejectedValue(original);

    const task = new ParsePdfTask(mockParser);
    await expect(task.execute(new Uint8Array([1]))).rejects.toBe(original);
  });

  it('deve encapsular erros genéricos em PdfParseError', async () => {
    (mockParser.getPageCount as jest.Mock).mockRejectedValue(new Error('boom'));

    const task = new ParsePdfTask(mockParser);
    await expect(task.execute(new Uint8Array([1]))).rejects.toThrow(PdfParseError);
    await expect(task.execute(new Uint8Array([1]))).rejects.toThrow('Erro ao contar páginas: boom');
  });

  it('deve lidar com erro sem message', async () => {
    (mockParser.getPageCount as jest.Mock).mockRejectedValue({});

    const task = new ParsePdfTask(mockParser);
    await expect(task.execute(new Uint8Array([1]))).rejects.toThrow('Erro desconhecido');
  });
});
