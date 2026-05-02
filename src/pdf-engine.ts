import {
  PdfProcessingConfig,
  PdfProcessingResult,
  PdfSplitResult,
  SplitOptions,
  WorkerStats,
} from './core/types';

export interface PdfEngine {
  process(buffer: Uint8Array, config?: PdfProcessingConfig): Promise<PdfProcessingResult>;
  processMultiple(results: PdfProcessingResult[]): Promise<PdfProcessingResult>;
  split(buffer: Uint8Array, uploadId: string, options?: SplitOptions): Promise<PdfSplitResult>;
  getPageCount(buffer: Uint8Array): Promise<number>;
  getStats(): WorkerStats;
  shutdown(): Promise<void>;
  shouldProcessInChunks(pageCount: number, config: PdfProcessingConfig): boolean;
}
