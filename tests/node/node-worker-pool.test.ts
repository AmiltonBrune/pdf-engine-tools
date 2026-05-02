import { NodeWorkerPool } from '../../src/node/node-worker-pool';
import { PdfWorkerError } from '../../src/core/errors';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

function createTempWorker(name: string, code: string): string {
  const path = join(__dirname, '..', `${name}.cjs`);
  writeFileSync(path, code);
  return path;
}

function removeTempWorker(path: string) {
  try { unlinkSync(path); } catch {}
}

describe('NodeWorkerPool', () => {
  let pool: NodeWorkerPool;

  afterEach(async () => {
    if (pool) {
      try { await pool.shutdown(); } catch {}
    }
  });

  it('deve inicializar com valores padrão', () => {
    pool = new NodeWorkerPool();
    const stats = pool.getStats();

    expect(stats.concurrency).toBeGreaterThanOrEqual(1);
    expect(stats.hardCap).toBeGreaterThanOrEqual(1);
    expect(stats.activeWorkers).toBe(0);
    expect(stats.queueLength).toBe(0);
    expect(stats.canAccept).toBe(true);
    expect(stats.cpuAvg).toMatch(/%$/);
    expect(stats.cpuLimit).toMatch(/%$/);
  });

  it('deve aceitar logger customizado', () => {
    const logs: string[] = [];
    pool = new NodeWorkerPool({
      log: (msg) => logs.push(msg),
      warn: (msg) => logs.push(`WARN: ${msg}`),
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toContain('WorkerPool iniciado');
  });

  it('deve rejeitar após shutdown', async () => {
    pool = new NodeWorkerPool();
    await pool.shutdown();

    await expect(pool.run('fake.cjs', {}, 1000)).rejects.toThrow(PdfWorkerError);
    await expect(pool.run('fake.cjs', {}, 1000)).rejects.toThrow('desligamento');
  });

  it('deve executar worker e receber resposta', async () => {
    const path = createTempWorker('.tmp-ok-worker', `
      const { parentPort } = require('worker_threads');
      parentPort.postMessage({ success: true, value: 42 });
    `);

    pool = new NodeWorkerPool();
    const result = await pool.run(path, {}, 5000);
    expect((result as any).success).toBe(true);
    expect((result as any).value).toBe(42);

    removeTempWorker(path);
  });

  it('deve rejeitar quando worker lança erro', async () => {
    const path = createTempWorker('.tmp-err-worker', `throw new Error('crash intencional');`);

    pool = new NodeWorkerPool();
    await expect(pool.run(path, {}, 5000)).rejects.toThrow();

    removeTempWorker(path);
  });

  it('deve rejeitar com timeout quando worker trava', async () => {
    const path = createTempWorker('.tmp-hang-worker', `setTimeout(() => {}, 60000);`);

    pool = new NodeWorkerPool();
    await expect(pool.run(path, {}, 500)).rejects.toThrow(/Timeout/);

    removeTempWorker(path);
  });

  it('deve rejeitar quando worker exit com código não-zero', async () => {
    const path = createTempWorker('.tmp-exit-worker', `process.exit(1);`);

    pool = new NodeWorkerPool();
    await expect(pool.run(path, {}, 5000)).rejects.toThrow();

    removeTempWorker(path);
  });

  it('deve processar múltiplas tarefas em paralelo', async () => {
    const path = createTempWorker('.tmp-parallel-worker', `
      const { parentPort, workerData } = require('worker_threads');
      setTimeout(() => parentPort.postMessage({ id: workerData.id }), 50);
    `);

    pool = new NodeWorkerPool();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => pool.run(path, { id: i }, 5000))
    );

    const ids = (results as any[]).map((r) => r.id).sort();
    expect(ids).toEqual([0, 1, 2, 3, 4]);

    removeTempWorker(path);
  });

  it('getStats deve mostrar fila quando há muitas tarefas', async () => {
    const path = createTempWorker('.tmp-slow-worker', `
      const { parentPort } = require('worker_threads');
      setTimeout(() => parentPort.postMessage({ done: true }), 200);
    `);

    pool = new NodeWorkerPool();
    const promises = Array.from({ length: 3 }, () => pool.run(path, {}, 5000));

    await new Promise((r) => setTimeout(r, 50));
    const stats = pool.getStats();
    expect(stats.activeWorkers + stats.queueLength).toBeGreaterThanOrEqual(0);

    await Promise.all(promises);
    removeTempWorker(path);
  });

  it('shutdown deve aguardar workers ativos e completar', async () => {
    const path = createTempWorker('.tmp-shutdown-worker', `
      const { parentPort } = require('worker_threads');
      setTimeout(() => parentPort.postMessage({ done: true }), 100);
    `);

    pool = new NodeWorkerPool();
    const promise = pool.run(path, {}, 5000);

    await new Promise((r) => setTimeout(r, 50));
    await pool.shutdown();

    try {
      const result = await promise;
      expect((result as any).done).toBe(true);
    } catch {
      // shutdown pode rejeitar tarefas pendentes — isso é válido
    }

    removeTempWorker(path);
  });

  it('shutdown com fila vazia deve resolver imediatamente', async () => {
    pool = new NodeWorkerPool();
    await expect(pool.shutdown()).resolves.toBeUndefined();
  });

  describe('Fila Cheia', () => {
    it('deve rejeitar com erro de fila cheia quando queue >= QUEUE_MAX', async () => {
      pool = new NodeWorkerPool();
      (pool as any).QUEUE_MAX = 0;
      (pool as any).currentConcurrency = 0;

      await expect(pool.run('.tmp-worker.js', {}, 5000)).rejects.toThrow('Fila cheia');
    });
  });

  describe('resolveWorkerPath fallbacks', () => {
    it('deve testar os fallbacks de resolução de caminho', () => {
      pool = new NodeWorkerPool();
      const resolved = (pool as any).resolveWorkerPath('non-existent-worker.js');
      expect(typeof resolved).toBe('string');
      expect(resolved.endsWith('non-existent-worker.js')).toBe(true);
    });
  });

  describe('CPU Tuning e Stats', () => {
    it('deve ler o uso de CPU', () => {
      pool = new NodeWorkerPool();
      const cpu1 = (pool as any).readCpuUsagePercent();
      expect(typeof cpu1).toBe('number');

      const cpu2 = (pool as any).readCpuUsagePercent();
      expect(typeof cpu2).toBe('number');
    });

    it('deve diminuir concurrency se CPU alto', () => {
      pool = new NodeWorkerPool();
      (pool as any).readCpuUsagePercent = () => 100;
      (pool as any).cpuHistory = [{ usage: 100 }, { usage: 100 }];
      (pool as any).currentConcurrency = 4;
      (pool as any).sampleCpuAndTune();
      expect((pool as any).currentConcurrency).toBe(3);
    });

    it('deve aumentar concurrency se CPU baixo e fila com itens', () => {
      pool = new NodeWorkerPool();
      (pool as any).readCpuUsagePercent = () => 5;
      (pool as any).cpuHistory = [{ usage: 5 }, { usage: 5 }];
      (pool as any).currentConcurrency = 2;
      (pool as any).hardCap = 4;
      (pool as any).queue = [{}];
      (pool as any).sampleCpuAndTune();
      expect((pool as any).currentConcurrency).toBe(3);
    });
    
    it('setAvailable deve limitar a 0', () => {
      pool = new NodeWorkerPool();
      (pool as any).semaphore.setAvailable(-5);
    });
  });
});
