import { existsSync } from 'fs';
import * as os from 'os';
import { join } from 'path';
import { Worker } from 'worker_threads';
import { createPdfWorkerError } from '../core/errors';
import { WorkerStats } from '../core/types';

type Task = {
  workerFile: string;
  workerData: unknown;
  timeoutMs: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

type CpuSample = { ts: number; usage: number };

function getAvailableCpus(): number {
  const ap = (os as any).availableParallelism;
  return typeof ap === 'function' ? Math.max(1, ap()) : Math.max(1, os.cpus().length);
}

export interface WorkerPoolAdapter {
  run<TData, TResult>(workerFile: string, workerData: TData, timeoutMs?: number): Promise<TResult>;
  getStats(): WorkerStats;
  shutdown(): Promise<void>;
}

export class NodeWorkerPool implements WorkerPoolAdapter {
  private currentConcurrency: number;
  private readonly hardCap: number;
  private readonly cpuLimit: number;
  private activeWorkers = 0;
  private readonly queue: Task[] = [];
  private isShuttingDown = false;
  private readonly onIdleResolvers: Array<() => void> = [];
  private cpuHistory: CpuSample[] = [];
  private lastCpuSnapshot: Array<{ idle: number; total: number }> | null = null;
  private readonly QUEUE_MAX: number;
  private semaphore: { acquire: () => Promise<void>; release: () => void; setAvailable: (n: number) => void };

  constructor(private readonly logger?: { log: (msg: string) => void; warn: (msg: string) => void }) {
    const CPU_LIMIT = Number(process.env.PDF_CPU_USAGE_LIMIT ?? 80);
    const HARD_CAP = Math.max(1, Number(process.env.PDF_MAX_WORKERS ?? getAvailableCpus()));
    const START_CONC = Math.max(1, Math.min(Number(process.env.PDF_MAX_CONCURRENCY ?? Math.min(getAvailableCpus() - 1, 4)), HARD_CAP));
    const QUEUE_MAX = Number(process.env.PDF_QUEUE_MAX ?? 100);

    this.currentConcurrency = START_CONC;
    this.hardCap = HARD_CAP;
    this.cpuLimit = CPU_LIMIT;
    this.QUEUE_MAX = QUEUE_MAX;

    let available = this.currentConcurrency;
    this.semaphore = {
      acquire: () => new Promise((resolve) => {
        if (available > 0) { available--; resolve(); }
        else { const check = () => { if (available > 0) { available--; resolve(); } else { setTimeout(check, 10); } }; check(); }
      }),
      release: () => { available++; },
      setAvailable: (n: number) => { available = Math.max(0, n); },
    };

    this.logger?.log(`WorkerPool iniciado | conc=${this.currentConcurrency} hardCap=${this.hardCap} cpuLimit=${this.cpuLimit}% queueMax=${QUEUE_MAX}`);
    setInterval(() => this.sampleCpuAndTune(), 2000).unref();
  }

  async run<TData, TResult>(workerFile: string, workerData: TData, timeoutMs = 30_000): Promise<TResult> {
    if (this.isShuttingDown) throw createPdfWorkerError('WorkerPool em desligamento');
    if (this.queue.length >= this.QUEUE_MAX && this.activeWorkers >= this.currentConcurrency) {
      throw createPdfWorkerError('Fila cheia — tente novamente mais tarde');
    }
    return new Promise<TResult>((resolve, reject) => {
      this.queue.push({ workerFile, workerData, timeoutMs, resolve, reject });
      queueMicrotask(() => this.tryDequeue());
    });
  }

  getStats(): WorkerStats {
    const { avg } = this.cpuAverage();
    return {
      concurrency: this.currentConcurrency, hardCap: this.hardCap,
      activeWorkers: this.activeWorkers, queueLength: this.queue.length,
      cpuAvg: `${avg.toFixed(1)}%`, cpuLimit: `${this.cpuLimit}%`,
      canAccept: this.queue.length < this.QUEUE_MAX,
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.logger?.log('Shutdown iniciado — aguardando workers ativos finalizarem...');
    await this.waitForIdle();
    this.queue.splice(0).forEach((t) => t.reject(createPdfWorkerError('WorkerPool desligado')));
    this.logger?.log('Shutdown concluído.');
  }

  private tryDequeue() {
    if (this.isShuttingDown || this.queue.length === 0) return;
    this.semaphore.acquire().then(() => {
      const task = this.queue.shift();
      if (!task) { this.semaphore.release(); return; }
      this.spawn(task).catch(() => {}).finally(() => { this.semaphore.release(); setImmediate(() => this.tryDequeue()); });
    });
  }

  private resolveWorkerPath(workerFile: string): string {
    const basename = workerFile.replace(/^.*\//, '');

    if ((workerFile.startsWith('/') || /^[A-Z]:/.test(workerFile)) && existsSync(workerFile)) return workerFile;

    const fromWorkers = join(__dirname, '..', 'workers', basename);
    if (existsSync(fromWorkers)) return fromWorkers;

    const direct = join(__dirname, workerFile);
    if (existsSync(direct)) return direct;

    return join(__dirname, workerFile);
  }

  private async spawn(task: Task): Promise<void> {
    const workerId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const workerPath = this.resolveWorkerPath(task.workerFile);
    const started = Date.now();
    this.activeWorkers += 1;

    const resolveIdle = () => {
      if (this.activeWorkers === 0 && this.onIdleResolvers.length > 0) {
        this.onIdleResolvers.splice(0).forEach((r) => r());
      }
    };

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const w = new Worker(workerPath, { workerData: task.workerData });
        const tid = setTimeout(() => { try { w.terminate(); } catch {} reject(createPdfWorkerError('Timeout do worker')); }, task.timeoutMs);
        const settle = (ok: boolean, p?: any) => { clearTimeout(tid); try { w.terminate(); } catch {} ok ? resolve(p) : reject(p); };
        w.on('message', (m) => settle(true, m));
        w.on('error', (e) => settle(false, e));
        w.on('exit', (c) => { if (c !== 0) settle(false, createPdfWorkerError(`Worker exit ${c}`)); });
      });
      task.resolve(result);
      this.logger?.log(`Worker#${workerId} ok in ${Date.now() - started}ms`);
    } catch (err: any) {
      task.reject(err);
      this.logger?.warn(`Worker#${workerId} fail in ${Date.now() - started}ms: ${err?.message ?? err}`);
    } finally {
      this.activeWorkers -= 1;
      resolveIdle();
    }
  }

  private waitForIdle(): Promise<void> {
    if (this.activeWorkers === 0) return Promise.resolve();
    return new Promise<void>((r) => this.onIdleResolvers.push(r));
  }

  private sampleCpuAndTune() {
    const usage = this.readCpuUsagePercent();
    this.cpuHistory.push({ ts: Date.now(), usage });
    if (this.cpuHistory.length > 10) this.cpuHistory.shift();
    const { avg } = this.cpuAverage();

    const desired = (() => {
      if (avg > this.cpuLimit && this.currentConcurrency > 1) return this.currentConcurrency - 1;
      if (avg < Math.max(10, this.cpuLimit - 15) && this.queue.length > 0) return Math.min(this.currentConcurrency + 1, this.hardCap);
      return this.currentConcurrency;
    })();

    if (desired !== this.currentConcurrency) {
      this.currentConcurrency = desired;
      const avail = Math.max(0, this.currentConcurrency - this.activeWorkers);
      this.semaphore.setAvailable(avail);
      this.logger?.log(`Tuning: cpuAvg=${avg.toFixed(1)}% -> concurrency=${this.currentConcurrency} (active=${this.activeWorkers} queue=${this.queue.length})`);
      if (avail > 0) setImmediate(() => this.tryDequeue());
    }
  }

  private cpuAverage() {
    if (this.cpuHistory.length === 0) return { avg: 0, n: 0 };
    const sum = this.cpuHistory.reduce((a, s) => a + s.usage, 0);
    return { avg: sum / this.cpuHistory.length, n: this.cpuHistory.length };
  }

  private readCpuUsagePercent(): number {
    const cpus = os.cpus();
    const snapshot = cpus.map((c) => {
      const total = c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
      return { idle: c.times.idle, total };
    });
    if (!this.lastCpuSnapshot) { this.lastCpuSnapshot = snapshot; return 0; }
    const deltas = snapshot.map((curr, i) => {
      const prev = this.lastCpuSnapshot![i];
      return { idle: curr.idle - (prev?.idle ?? 0), total: curr.total - (prev?.total ?? 0) };
    });
    const { idleSum, totalSum } = deltas.reduce((a, d) => ({ idleSum: a.idleSum + d.idle, totalSum: a.totalSum + d.total }), { idleSum: 0, totalSum: 0 });
    this.lastCpuSnapshot = snapshot;
    if (totalSum <= 0) return 0;
    return ((totalSum - idleSum) / totalSum) * 100;
  }
}
