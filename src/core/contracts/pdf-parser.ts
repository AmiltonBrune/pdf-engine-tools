export interface PdfParser {
  getPageCount(buffer: Uint8Array): Promise<number>;
}
