export interface PdfProcessingConfig {
  pageLimit?: number;
  enablePageLimit?: boolean;
  maxChunkSize?: number;
  timeout?: number;
  debug?: boolean;
}

export interface PdfProcessingResult {
  success: boolean;
  text: string;
  pageCount: number;
  originalPageCount?: number;
  truncated?: boolean;
  isCorrupted?: boolean;
  isSigned?: boolean;
  isSignedWithin2Days?: boolean;
  signatureDates?: string[];
  rawData?: unknown;
  error?: string;
  errorPages?: number[];
}

export interface PdfChunk {
  page: number;
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface PdfSplitResult {
  filePaths: string[];
  totalParts: number;
  chunkSize: number;
}

export interface PdfInfo {
  pageCount: number;
  size: number;
  isValid: boolean;
}

export interface WorkerStats {
  concurrency: number;
  hardCap: number;
  activeWorkers: number;
  queueLength: number;
  cpuAvg: string;
  cpuLimit: string;
  canAccept: boolean;
}

export interface ExtractOptions {
  pageLimit?: number;
}

export interface ExtractResult {
  text: string;
  pageCount: number;
  originalPageCount?: number;
  truncated?: boolean;
  isCorrupted?: boolean;
  isSigned?: boolean;
  isSignedWithin2Days?: boolean;
  signatureDates?: string[];
  rawData?: unknown;
  errorPages?: number[];
}

export interface SplitOptions {
  chunkSize: number;
}

export interface SplitChunkResult {
  chunks: Uint8Array[];
  totalParts: number;
  originalPageCount: number;
}
