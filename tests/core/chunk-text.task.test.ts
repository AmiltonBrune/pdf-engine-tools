import { ChunkTextTask } from '../../src/core/tasks/chunk-text.task';

describe('ChunkTextTask', () => {
  const task = new ChunkTextTask();

  it('deve retornar array vazio para texto vazio', () => {
    expect(task.execute('', 100, 1)).toEqual([]);
  });

  it('deve retornar array vazio para texto só com espaços', () => {
    expect(task.execute('   \n  \n  ', 100, 1)).toEqual([]);
  });

  it('deve criar um único chunk quando texto cabe no maxChunkSize', () => {
    const chunks = task.execute('Linha 1\nLinha 2', 1000, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toContain('Linha 1');
    expect(chunks[0]!.text).toContain('Linha 2');
    expect(chunks[0]!.page).toBe(1);
    expect(chunks[0]!.startIndex).toBe(0);
  });

  it('deve dividir texto em múltiplos chunks quando excede maxChunkSize', () => {
    const longText = Array.from({ length: 20 }, (_, i) => `Linha número ${i + 1} com conteúdo extenso para forçar split`).join('\n');
    const chunks = task.execute(longText, 100, 5);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.text.length).toBeGreaterThan(0);
      expect(chunk.page).toBeGreaterThanOrEqual(1);
      expect(chunk.page).toBeLessThanOrEqual(5);
      expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
      expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
    });
  });

  it('deve respeitar pageCount como limite máximo de página', () => {
    const longText = Array.from({ length: 50 }, (_, i) => `L${i}`).join('\n');
    const chunks = task.execute(longText, 10, 3);

    chunks.forEach((chunk) => {
      expect(chunk.page).toBeLessThanOrEqual(3);
    });
  });

  it('deve manter índices contíguos entre chunks', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Linha ${i}`).join('\n');
    const chunks = task.execute(text, 50, 10);

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.startIndex).toBe(chunks[i - 1]!.endIndex);
    }
  });

  it('deve funcionar com texto de uma única linha grande', () => {
    const text = 'A'.repeat(500);
    const chunks = task.execute(text, 1000, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(text);
  });

  it('deve lidar com texto null/undefined via guard', () => {
    expect(task.execute(null as any, 100, 1)).toEqual([]);
    expect(task.execute(undefined as any, 100, 1)).toEqual([]);
  });
});
