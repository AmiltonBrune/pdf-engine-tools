import { PdfChunk } from '../types';

export class ChunkTextTask {
  execute(text: string, maxChunkSize: number, pageCount: number): PdfChunk[] {
    if (!text || text.trim().length === 0) return [];

    const chunks: PdfChunk[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    let currentPage = 1;
    let startIndex = 0;

    for (const line of lines) {
      const lineWithNewline = line + '\n';

      if (currentChunk.length + lineWithNewline.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          page: currentPage,
          text: currentChunk.trim(),
          startIndex,
          endIndex: startIndex + currentChunk.length,
        });
        startIndex += currentChunk.length;
        currentChunk = lineWithNewline;
        currentPage = Math.min(currentPage + 1, pageCount);
      } else {
        currentChunk += lineWithNewline;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        page: currentPage,
        text: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length,
      });
    }

    return chunks;
  }
}
