import { normalizeBuffer } from '../../src/node/buffer-utils';

describe('normalizeBuffer', () => {
  it('deve retornar Buffer se input já é Buffer', () => {
    const buf = Buffer.from([1, 2, 3]);
    const result = normalizeBuffer(buf);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toBe(buf);
  });

  it('deve converter Uint8Array para Buffer', () => {
    const uint = new Uint8Array([4, 5, 6]);
    const result = normalizeBuffer(uint);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result[0]).toBe(4);
    expect(result[1]).toBe(5);
    expect(result[2]).toBe(6);
  });

  it('deve converter objeto serializado { type: "Buffer", data: [...] }', () => {
    const serialized = { type: 'Buffer', data: [7, 8, 9] };
    const result = normalizeBuffer(serialized);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result[0]).toBe(7);
  });

  it('deve lançar erro para string', () => {
    expect(() => normalizeBuffer('string')).toThrow('Buffer inválido');
  });

  it('deve lançar erro para number', () => {
    expect(() => normalizeBuffer(42)).toThrow('Buffer inválido');
  });

  it('deve lançar erro para null', () => {
    expect(() => normalizeBuffer(null)).toThrow('Buffer inválido');
  });

  it('deve lançar erro para undefined', () => {
    expect(() => normalizeBuffer(undefined)).toThrow('Buffer inválido');
  });

  it('deve lançar erro para objeto sem type Buffer', () => {
    expect(() => normalizeBuffer({ type: 'Array', data: [1] })).toThrow('Buffer inválido');
  });

  it('deve lançar erro para objeto com type Buffer mas data não-array', () => {
    expect(() => normalizeBuffer({ type: 'Buffer', data: 'abc' })).toThrow('Buffer inválido');
  });
});
