import { PdfPipeline } from '../../src/core/pipeline/pdf-pipeline';
import { PipelineExecutor } from '../../src/core/pipeline/pipeline-executor';
import { PdfTextExtractor } from '../../src/core/contracts/pdf-text-extractor';
import { PdfParseError } from '../../src/core/errors';
import { ExtractResult, PdfProcessingResult } from '../../src/core/types';

describe('PdfPipeline', () => {
  const mockExtractor: PdfTextExtractor = { extract: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  const fakeExtract: ExtractResult = {
    text: 'texto do pdf',
    pageCount: 10,
    originalPageCount: 10,
    truncated: false,
    isCorrupted: false,
    isSigned: true,
    isSignedWithin2Days: false,
    signatureDates: ['2024-01-15'],
    rawData: { Pages: [] },
    errorPages: [2],
  };

  describe('process', () => {
    it('deve processar buffer e retornar resultado com success=true', async () => {
      (mockExtractor.extract as jest.Mock).mockResolvedValue(fakeExtract);
      const pipeline = new PdfPipeline(mockExtractor);
      const result = await pipeline.process(new Uint8Array([1, 2, 3]), { pageLimit: 10 });

      expect(result.success).toBe(true);
      expect(result.text).toBe('texto do pdf');
      expect(result.pageCount).toBe(10);
      expect(result.isSigned).toBe(true);
      expect(result.signatureDates).toEqual(['2024-01-15']);
      expect(result.rawData).toEqual({ Pages: [] });
      expect(result.errorPages).toEqual([2]);
    });

    it('deve passar pageLimit ao extractor quando enablePageLimit=true', async () => {
      (mockExtractor.extract as jest.Mock).mockResolvedValue(fakeExtract);
      const pipeline = new PdfPipeline(mockExtractor);
      await pipeline.process(new Uint8Array([1]), { pageLimit: 5, enablePageLimit: true });

      expect(mockExtractor.extract).toHaveBeenCalledWith(new Uint8Array([1]), { pageLimit: 5 });
    });

    it('deve passar pageLimit=undefined quando enablePageLimit=false', async () => {
      (mockExtractor.extract as jest.Mock).mockResolvedValue(fakeExtract);
      const pipeline = new PdfPipeline(mockExtractor);
      await pipeline.process(new Uint8Array([1]), { pageLimit: 5, enablePageLimit: false });

      expect(mockExtractor.extract).toHaveBeenCalledWith(new Uint8Array([1]), { pageLimit: undefined });
    });

    it('deve lançar PdfParseError para buffer vazio', async () => {
      const pipeline = new PdfPipeline(mockExtractor);
      await expect(pipeline.process(new Uint8Array([]), {})).rejects.toThrow(PdfParseError);
    });

    it('deve propagar PdfParseError sem encapsular', async () => {
      const original = new PdfParseError('parser falhou');
      (mockExtractor.extract as jest.Mock).mockRejectedValue(original);

      const pipeline = new PdfPipeline(mockExtractor);
      await expect(pipeline.process(new Uint8Array([1]), {})).rejects.toBe(original);
    });

    it('deve encapsular erros genéricos em PdfParseError', async () => {
      (mockExtractor.extract as jest.Mock).mockRejectedValue(new Error('crash'));

      const pipeline = new PdfPipeline(mockExtractor);
      await expect(pipeline.process(new Uint8Array([1]), {})).rejects.toThrow('Erro no pipeline: crash');
    });

    it('deve encapsular erro desconhecido (sem message)', async () => {
      (mockExtractor.extract as jest.Mock).mockRejectedValue('something weird');

      const pipeline = new PdfPipeline(mockExtractor);
      await expect(pipeline.process(new Uint8Array([1]), {})).rejects.toThrow('Erro no pipeline: Erro desconhecido');
    });
  });

  describe('processMultiple', () => {
    const pipeline = new PdfPipeline(mockExtractor);

    it('deve lançar PdfParseError para array vazio', () => {
      expect(() => pipeline.processMultiple([])).toThrow(PdfParseError);
      expect(() => pipeline.processMultiple([])).toThrow('Nenhum resultado para combinar');
    });

    it('deve retornar failure quando todos falharam', () => {
      const results: PdfProcessingResult[] = [
        { success: false, text: '', pageCount: 0, error: 'err1' },
        { success: false, text: '', pageCount: 0, error: 'err2' },
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined.success).toBe(false);
      expect(combined.error).toContain('err1');
      expect(combined.error).toContain('err2');
    });

    it('deve retornar failure com mensagem padrão se erros são undefined', () => {
      const results: PdfProcessingResult[] = [
        { success: false, text: '', pageCount: 0 },
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined.success).toBe(false);
      expect(combined.error).toBe('Todos os resultados falharam');
    });

    it('deve retornar o único resultado sucesso diretamente', () => {
      const single: PdfProcessingResult = { success: true, text: 'abc', pageCount: 3 };
      const results: PdfProcessingResult[] = [
        { success: false, text: '', pageCount: 0, error: 'err' },
        single,
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined).toBe(single);
    });

    it('deve combinar múltiplos resultados com sucesso', () => {
      const results: PdfProcessingResult[] = [
        { success: true, text: 'parte 1', pageCount: 5, originalPageCount: 5, isSigned: true, signatureDates: ['2024-01-15'], isSignedWithin2Days: false, truncated: false, isCorrupted: false, rawData: 'data1', errorPages: [1] },
        { success: true, text: 'parte 2', pageCount: 10, originalPageCount: 10, isSigned: false, signatureDates: ['2024-01-20'], truncated: true, isCorrupted: false, errorPages: [2] },
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined.success).toBe(true);
      expect(combined.text).toBe('parte 1\n\nparte 2');
      expect(combined.pageCount).toBe(15);
      expect(combined.originalPageCount).toBe(15);
      expect(combined.truncated).toBe(true);
      expect(combined.isCorrupted).toBe(false);
      expect(combined.isSigned).toBe(true);
      expect(combined.signatureDates).toEqual(['2024-01-15', '2024-01-20']);
      expect(combined.rawData).toBe('data1');
      expect(combined.errorPages).toEqual([1, 2]);
    });

    it('deve deduplicar signatureDates', () => {
      const results: PdfProcessingResult[] = [
        { success: true, text: 'a', pageCount: 1, signatureDates: ['2024-01-15'] },
        { success: true, text: 'b', pageCount: 1, signatureDates: ['2024-01-15', '2024-01-20'] },
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined.signatureDates).toEqual(['2024-01-15', '2024-01-20']);
    });

    it('deve filtrar textos vazios ao combinar', () => {
      const results: PdfProcessingResult[] = [
        { success: true, text: 'conteúdo', pageCount: 5 },
        { success: true, text: '  ', pageCount: 0 },
      ];

      const combined = pipeline.processMultiple(results);
      expect(combined.text).toBe('conteúdo');
    });
  });

  describe('shouldProcessInChunks', () => {
    const pipeline = new PdfPipeline(mockExtractor);

    it('deve retornar true quando pageCount > pageLimit', () => {
      expect(pipeline.shouldProcessInChunks(20, { pageLimit: 10 })).toBe(true);
    });

    it('deve retornar false quando pageCount <= pageLimit', () => {
      expect(pipeline.shouldProcessInChunks(5, { pageLimit: 10 })).toBe(false);
    });

    it('deve usar default de 12 quando pageLimit não definido', () => {
      expect(pipeline.shouldProcessInChunks(15, {})).toBe(true);
      expect(pipeline.shouldProcessInChunks(10, {})).toBe(false);
    });

    it('deve retornar false quando enablePageLimit=false', () => {
      expect(pipeline.shouldProcessInChunks(100, { enablePageLimit: false })).toBe(false);
    });
  });
});

describe('PipelineExecutor', () => {
  it('deve executar steps em sequência', async () => {
    const executor = new PipelineExecutor();
    const steps = [
      { execute: async (n: number) => n * 2 },
      { execute: async (n: number) => n + 10 },
    ];

    const result = await executor.execute<number, number>(5, steps);
    expect(result).toBe(20); // (5 * 2) + 10
  });

  it('deve retornar input quando não há steps', async () => {
    const executor = new PipelineExecutor();
    const result = await executor.execute('hello', []);
    expect(result).toBe('hello');
  });
});
