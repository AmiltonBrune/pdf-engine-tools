import { SplitChunkResult, SplitOptions } from '../types';

export interface PdfSplitter {
  split(buffer: Uint8Array, options: SplitOptions): Promise<SplitChunkResult>;
}
