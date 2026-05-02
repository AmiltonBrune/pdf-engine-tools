import { promises as fs } from 'fs';
import * as path from 'path';

export interface FsAdapter {
  readFile(filePath: string): Promise<Buffer>;
  writeFile(filePath: string, data: Buffer): Promise<void>;
  mkdir(dirPath: string, recursive?: boolean): Promise<void>;
  readdir(dirPath: string): Promise<string[]>;
  unlink(filePath: string): Promise<void>;
  rmdir(dirPath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}

export class NodeFsAdapter implements FsAdapter {
  async readFile(filePath: string): Promise<Buffer> { return fs.readFile(filePath); }
  async writeFile(filePath: string, data: Buffer): Promise<void> { await fs.writeFile(filePath, data); }
  async mkdir(dirPath: string, recursive = true): Promise<void> { await fs.mkdir(dirPath, { recursive }); }
  async readdir(dirPath: string): Promise<string[]> { return fs.readdir(dirPath); }
  async unlink(filePath: string): Promise<void> { await fs.unlink(filePath); }
  async rmdir(dirPath: string): Promise<void> { await fs.rmdir(dirPath); }
  async exists(filePath: string): Promise<boolean> {
    try { await fs.access(filePath); return true; } catch { return false; }
  }
}

export class PdfFsOperations {
  constructor(private readonly fs: FsAdapter) {}

  async cleanupDirectory(dirPath: string): Promise<void> {
    try {
      if (await this.fs.exists(dirPath)) {
        const files = await this.fs.readdir(dirPath);
        await Promise.all(files.map((f) => this.fs.unlink(path.join(dirPath, f))));
        await this.fs.rmdir(dirPath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup directory ${dirPath}:`, error);
    }
  }

  async ensureDirectory(dirPath: string): Promise<void> { await this.fs.mkdir(dirPath, true); }
  async writePdfChunk(filePath: string, data: Buffer): Promise<void> { await this.fs.writeFile(filePath, data); }
  async readPdfChunk(filePath: string): Promise<Buffer> { return this.fs.readFile(filePath); }
}
