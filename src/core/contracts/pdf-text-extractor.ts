import { ExtractOptions, ExtractResult } from '../types';

export interface PdfTextExtractor {
  extract(buffer: Uint8Array, options?: ExtractOptions): Promise<ExtractResult>;
}
