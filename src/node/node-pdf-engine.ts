import { Pdf2JsonExtractor } from '../adapters/pdf2json/pdf2json-extractor';
import { PdfLibSplitter } from '../adapters/pdf-lib/pdf-lib-splitter';
import { PdfPipeline } from '../core/pipeline/pdf-pipeline';
import {
  PdfProcessingConfig,
  PdfProcessingResult,
  PdfSplitResult,
  SplitOptions,
  WorkerStats,
} from '../core/types';

import { NodeFsAdapter, PdfFsOperations } from './node-fs-adapter';
import { NodeWorkerPool } from './node-worker-pool';
import { PdfEngine } from '../pdf-engine';

export class NodePdfEngine implements PdfEngine {
  private readonly pipeline: PdfPipeline;
  private readonly splitter: PdfLibSplitter;
  private readonly workerPool: NodeWorkerPool;
  private readonly pdfFs: PdfFsOperations;

  constructor(logger?: { log: (msg: string) => void; warn: (msg: string) => void }) {
    const extractor = new Pdf2JsonExtractor();
    this.pipeline = new PdfPipeline(extractor);
    this.splitter = new PdfLibSplitter();
    this.workerPool = new NodeWorkerPool(logger);
    this.pdfFs = new PdfFsOperations(new NodeFsAdapter());
  }

  async process(buffer: Uint8Array, config?: PdfProcessingConfig): Promise<PdfProcessingResult> {
    return this.pipeline.process(buffer, config ?? {});
  }

  async processMultiple(results: PdfProcessingResult[]): Promise<PdfProcessingResult> {
    return this.pipeline.processMultiple(results);
  }

  async split(buffer: Uint8Array, uploadId: string, options?: SplitOptions): Promise<PdfSplitResult> {
    const chunkSize = options?.chunkSize ?? 12;
    const result = await this.splitter.split(buffer, { chunkSize });
    const outputDir = `temp/${uploadId}`;
    await this.pdfFs.ensureDirectory(outputDir);

    const filePaths: string[] = [];
    for (let i = 0; i < result.chunks.length; i++) {
      const path = `${outputDir}/part_${i + 1}.pdf`;
      await this.pdfFs.writePdfChunk(path, Buffer.from(result.chunks[i]!));
      filePaths.push(path);
    }

    return { filePaths, totalParts: result.totalParts, chunkSize };
  }

  async getPageCount(buffer: Uint8Array): Promise<number> {
    return this.workerPool.run<any, any>(
      'parse-pdf.worker.js',
      { buffer: Buffer.from(buffer) },
      30_000
    ).then((r: any) => {
      if (r?.success) return r.pageCount;
      throw new Error(r?.error || 'Erro ao contar páginas');
    });
  }

  getStats(): WorkerStats {
    return this.workerPool.getStats();
  }

  async shutdown(): Promise<void> {
    await this.workerPool.shutdown();
  }

  shouldProcessInChunks(pageCount: number, config: PdfProcessingConfig): boolean {
    return this.pipeline.shouldProcessInChunks(pageCount, config);
  }
}
