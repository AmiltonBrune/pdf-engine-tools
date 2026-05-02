/**
 * Jest global setup – silences noisy internal logs from pdf2json.
 *
 * pdf2json emits console.log calls AND direct process.stdout.write calls via
 * its bundled pdfjs-code. These are implementation details that clutter test
 * output without providing actionable information for library consumers:
 *
 *  - "Warning: Setting up fake worker."   – once per PDFParser instance
 *  - "(while reading XRef): …"            – for corrupt/truncated PDFs
 *  - "Error: Error: Invalid XRef …"       – for corrupt/truncated PDFs
 *
 * Strategy:
 *  1. Patch process.stdout.write at the TOP LEVEL (runs immediately on load,
 *     before any test – catches writes that happen outside Jest hooks).
 *  2. Also patch console.* inside beforeAll (belt-and-suspenders).
 *  3. Restore everything in afterAll.
 */

// Makes this a proper ES module so const declarations don't leak to global scope
export {};

const SUPPRESSED_PATTERNS: RegExp[] = [
  /Warning: Setting up fake worker/,
  /\(while reading XRef\)/,
  /Invalid XRef stream/,
  /Error: Error:/,
];

function shouldSuppress(text: string): boolean {
  return SUPPRESSED_PATTERNS.some((p) => p.test(text));
}

// ─── Top-level stdout patch (fires before any test hook) ─────────────────────
const originalStdoutWrite = process.stdout.write.bind(process.stdout);

(process.stdout.write as any) = function (
  chunk: string | Uint8Array,
  encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
  cb?: (err?: Error | null) => void
): boolean {
  const text = typeof chunk === 'string' ? chunk : chunk.toString();
  if (shouldSuppress(text)) {
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    callback?.(null);
    return true;
  }
  return typeof encodingOrCb === 'function'
    ? originalStdoutWrite(chunk, encodingOrCb)
    : originalStdoutWrite(chunk, encodingOrCb as BufferEncoding, cb!);
};

// ─── Console patch (runs per test suite via beforeAll) ───────────────────────
const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

function argsToString(args: unknown[]): string {
  return args.map((a) => String(a)).join(' ');
}

beforeAll(() => {
  console.log = (...args: unknown[]) => {
    if (!shouldSuppress(argsToString(args))) originalConsoleLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (!shouldSuppress(argsToString(args))) originalConsoleWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (!shouldSuppress(argsToString(args))) originalConsoleError(...args);
  };
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  process.stdout.write = originalStdoutWrite;
});
