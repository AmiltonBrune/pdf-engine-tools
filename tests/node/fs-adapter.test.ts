import { promises as fs } from 'fs';
import { join } from 'path';
import { NodeFsAdapter, PdfFsOperations } from '../../src/node/node-fs-adapter';

const TEMP_DIR = join(__dirname, '..', '.tmp-fs-test');

describe('NodeFsAdapter', () => {
  const adapter = new NodeFsAdapter();

  afterAll(async () => {
    try { await fs.rm(TEMP_DIR, { recursive: true }); } catch {}
  });

  it('deve criar diretório recursivamente', async () => {
    const dir = join(TEMP_DIR, 'a', 'b', 'c');
    await adapter.mkdir(dir, true);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('deve escrever e ler arquivo', async () => {
    const filePath = join(TEMP_DIR, 'test.txt');
    const data = Buffer.from('conteúdo de teste');
    await adapter.writeFile(filePath, data);
    const read = await adapter.readFile(filePath);
    expect(read.toString()).toBe('conteúdo de teste');
  });

  it('deve listar diretório', async () => {
    const files = await adapter.readdir(TEMP_DIR);
    expect(files).toContain('test.txt');
    expect(files).toContain('a');
  });

  it('deve verificar existência de arquivo', async () => {
    expect(await adapter.exists(join(TEMP_DIR, 'test.txt'))).toBe(true);
    expect(await adapter.exists(join(TEMP_DIR, 'inexistente.txt'))).toBe(false);
  });

  it('deve deletar arquivo', async () => {
    const filePath = join(TEMP_DIR, 'to-delete.txt');
    await adapter.writeFile(filePath, Buffer.from('temp'));
    await adapter.unlink(filePath);
    expect(await adapter.exists(filePath)).toBe(false);
  });

  it('deve deletar diretório vazio', async () => {
    const dir = join(TEMP_DIR, 'empty-dir');
    await adapter.mkdir(dir);
    await adapter.rmdir(dir);
    expect(await adapter.exists(dir)).toBe(false);
  });
});

describe('PdfFsOperations', () => {
  const adapter = new NodeFsAdapter();
  const ops = new PdfFsOperations(adapter);

  afterAll(async () => {
    try { await fs.rm(TEMP_DIR, { recursive: true }); } catch {}
  });

  it('deve criar diretório com ensureDirectory', async () => {
    const dir = join(TEMP_DIR, 'ops-test');
    await ops.ensureDirectory(dir);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('deve escrever e ler chunk PDF', async () => {
    const filePath = join(TEMP_DIR, 'ops-test', 'chunk.pdf');
    const data = Buffer.from('%PDF-1.4 fake content');
    await ops.writePdfChunk(filePath, data);
    const read = await ops.readPdfChunk(filePath);
    expect(read.toString()).toBe('%PDF-1.4 fake content');
  });

  it('deve limpar diretório com cleanupDirectory', async () => {
    const dir = join(TEMP_DIR, 'cleanup-test');
    await adapter.mkdir(dir);
    await adapter.writeFile(join(dir, 'file1.txt'), Buffer.from('a'));
    await adapter.writeFile(join(dir, 'file2.txt'), Buffer.from('b'));

    await ops.cleanupDirectory(dir);
    expect(await adapter.exists(dir)).toBe(false);
  });

  it('deve não lançar erro ao limpar diretório inexistente', async () => {
    await expect(ops.cleanupDirectory(join(TEMP_DIR, 'nao-existe'))).resolves.toBeUndefined();
  });
});
