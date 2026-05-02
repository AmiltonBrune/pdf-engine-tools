export function normalizeBuffer(input: any): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (input?.type === 'Buffer' && Array.isArray(input.data)) return Buffer.from(input.data);
  throw new Error(`Buffer inválido. Tipo: ${typeof input}, constructor: ${input?.constructor?.name}`);
}
