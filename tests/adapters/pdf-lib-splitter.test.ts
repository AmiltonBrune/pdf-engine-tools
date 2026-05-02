import { readFileSync } from 'fs';
import { join } from 'path';
import { PdfLibSplitter } from '../../src/adapters/pdf-lib/pdf-lib-splitter';

const PDF_DIR = join(__dirname, '..', 'pdfs');

describe('PdfLibSplitter', () => {
  const splitter = new PdfLibSplitter();

  it('deve dividir documento1.pdf (25 páginas) em chunks de 10', async () => {
    const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
    const result = await splitter.split(buffer, { chunkSize: 10 });

    expect(result.originalPageCount).toBe(25);
    expect(result.totalParts).toBe(3); // 10 + 10 + 5
    expect(result.chunks).toHaveLength(3);
    result.chunks.forEach((chunk) => {
      expect(chunk).toBeInstanceOf(Uint8Array);
      expect(chunk.length).toBeGreaterThan(0);
      const header = Buffer.from(chunk.slice(0, 5)).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });

  it('deve dividir em chunks de 25 (sem divisão real)', async () => {
    const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
    const result = await splitter.split(buffer, { chunkSize: 25 });

    expect(result.totalParts).toBe(1);
    expect(result.chunks).toHaveLength(1);
    expect(result.originalPageCount).toBe(25);
  });

  it('deve dividir em chunks de 1 (uma página por chunk)', async () => {
    const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
    const result = await splitter.split(buffer, { chunkSize: 1 });

    expect(result.totalParts).toBe(25);
    expect(result.chunks).toHaveLength(25);
  });

  it('deve dividir documento2.pdf', async () => {
    const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
    const result = await splitter.split(buffer, { chunkSize: 5 });

    expect(result.originalPageCount).toBeGreaterThan(0);
    expect(result.totalParts).toBe(Math.ceil(result.originalPageCount / 5));
    expect(result.chunks).toHaveLength(result.totalParts);
  });

  it('deve lançar erro para buffer inválido', async () => {
    await expect(splitter.split(new Uint8Array([1, 2, 3]), { chunkSize: 5 }))
      .rejects.toThrow();
  });
});
