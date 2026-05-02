/**
 * Early stdout/stderr patch for Jest – loaded via `setupFiles` (before any
 * module imports and before the test framework is installed).
 *
 * pdf2json's bundled pdfjs-code writes noise directly to process.stdout AND
 * process.stderr during module initialisation (before any test hook fires).
 * This file patches both streams early enough to suppress those messages.
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

function makePatchedWrite(
  original: typeof process.stdout.write
): typeof process.stdout.write {
  return function (
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
      ? original(chunk, encodingOrCb)
      : original(chunk, encodingOrCb as BufferEncoding, cb!);
  } as typeof process.stdout.write;
}

process.stdout.write = makePatchedWrite(process.stdout.write.bind(process.stdout));
process.stderr.write = makePatchedWrite(process.stderr.write.bind(process.stderr));
