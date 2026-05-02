import { readFileSync } from 'fs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { NodePdfEngine } from '../../src/node/node-pdf-engine';
import { PdfEngineError } from '../../src/core/errors';

const PDF_DIR = join(__dirname, '..', 'pdfs');
const TEMP_DIR = join(__dirname, '..', '.tmp-engine-test');

describe('NodePdfEngine', () => {
  let engine: NodePdfEngine;

  beforeAll(() => {
    engine = new NodePdfEngine();
  });

  afterAll(async () => {
    await engine.shutdown();
    try { await fs.rm(TEMP_DIR, { recursive: true }); } catch {}
    try { await fs.rm(join(process.cwd(), 'temp'), { recursive: true }); } catch {}
  });

  describe('process', () => {
    it('deve processar documento1.pdf com sucesso', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await engine.process(buffer, { pageLimit: 10 });

      expect(result.success).toBe(true);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.pageCount).toBeGreaterThan(0);
      expect(typeof result.isCorrupted).toBe('boolean');
      expect(typeof result.isSigned).toBe('boolean');
    });

    it('deve processar documento2.pdf', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const result = await engine.process(buffer);

      expect(result.success).toBe(true);
      expect(result.pageCount).toBeGreaterThan(0);
    });

    it('deve truncar com pageLimit', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await engine.process(buffer, { pageLimit: 3, enablePageLimit: true });

      expect(result.pageCount).toBe(3);
      expect(result.truncated).toBe(true);
      expect(result.originalPageCount).toBe(25);
    });

    it('deve lançar erro para buffer vazio', async () => {
      await expect(engine.process(new Uint8Array([]))).rejects.toThrow(PdfEngineError);
    });
  });

  describe('processMultiple', () => {
    it('deve combinar múltiplos resultados', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const r1 = await engine.process(buffer, { pageLimit: 5 });
      const r2 = await engine.process(buffer, { pageLimit: 3 });

      const combined = await engine.processMultiple([r1, r2]);
      expect(combined.success).toBe(true);
      expect(combined.pageCount).toBe(r1.pageCount + r2.pageCount);
    });
  });

  describe('split', () => {
    it('deve dividir documento1.pdf e salvar arquivos', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const uploadId = `test-${Date.now()}`;
      const result = await engine.split(buffer, uploadId, { chunkSize: 10 });

      expect(result.totalParts).toBe(3);
      expect(result.filePaths).toHaveLength(3);
      expect(result.chunkSize).toBe(10);

      for (const filePath of result.filePaths) {
        const content = readFileSync(filePath);
        const header = content.toString('ascii', 0, 5);
        expect(header).toBe('%PDF-');
      }
    });
  });

  describe('getStats', () => {
    it('deve retornar estatísticas válidas', () => {
      const stats = engine.getStats();
      expect(stats.concurrency).toBeGreaterThanOrEqual(1);
      expect(stats.hardCap).toBeGreaterThanOrEqual(1);
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queueLength).toBeGreaterThanOrEqual(0);
      expect(stats.canAccept).toBe(true);
      expect(stats.cpuAvg).toMatch(/%$/);
      expect(stats.cpuLimit).toMatch(/%$/);
    });
  });

  describe('shouldProcessInChunks', () => {
    it('deve retornar true quando pageCount excede pageLimit', () => {
      expect(engine.shouldProcessInChunks(20, { pageLimit: 10 })).toBe(true);
    });

    it('deve retornar false quando pageCount dentro do limite', () => {
      expect(engine.shouldProcessInChunks(5, { pageLimit: 10 })).toBe(false);
    });
  });

  describe('getPageCount', () => {
    it('deve retornar o número de páginas usando worker', async () => {
      const mockRun = jest.spyOn((engine as any).workerPool, 'run');
      mockRun.mockResolvedValueOnce({ success: true, pageCount: 25 });

      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const count = await engine.getPageCount(buffer);
      expect(count).toBe(25);
      mockRun.mockRestore();
    });

    it('deve propagar erro se worker falhar', async () => {
      const mockRun = jest.spyOn((engine as any).workerPool, 'run');
      mockRun.mockResolvedValueOnce({ success: false, error: 'Worker quebrou' });

      await expect(engine.getPageCount(new Uint8Array([1, 2, 3]))).rejects.toThrow('Worker quebrou');
      mockRun.mockRestore();
    });
  });
});
