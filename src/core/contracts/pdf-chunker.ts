import { PdfChunk } from '../types';

export interface PdfChunker {
  chunk(text: string, maxChunkSize: number, pageCount: number): PdfChunk[];
}
