// src/WAL.ts
import { open, mkdir, readFile, stat } from 'fs/promises';
import { constants } from 'fs';
import * as path from 'path';
import type { FileHandle } from 'fs/promises';

export interface WALEntry {
  op: 'SET' | 'DEL';
  key: string;
  value?: string;
  ttlSeconds?: number;
  timestamp: number;
}

export interface WALOptions {
  /** fsync after every append (safest, slowest) */
  syncOnWrite?: boolean;
}

export class WAL {
  private filePath: string;
  private handle: FileHandle | null = null;
  private syncOnWrite: boolean;

  private constructor(filePath: string, syncOnWrite: boolean) {
    this.filePath = filePath;
    this.syncOnWrite = syncOnWrite;
  }

  /** Async factory — replaces sync constructor */
  static async open(dataDir: string, options: WALOptions = {}): Promise<WAL> {
    await mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, 'store.aof');
    const wal = new WAL(filePath, options.syncOnWrite ?? false);

    wal.handle = await open(filePath, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY);
    return wal;
  }

  async append(entry: WALEntry): Promise<void> {
    if (!this.handle) throw new Error('WAL is closed');

    const line = JSON.stringify(entry) + '\n';
    await this.handle.write(line, null, 'utf8');

    if (this.syncOnWrite) {
      await this.handle.sync(); // like fsync — data on disk before returning
    }
  }

  /** Force any OS buffers to disk */
  async flush(): Promise<void> {
    if (!this.handle) return;
    await this.handle.sync();
  }

  async readAll(): Promise<WALEntry[]> {
    // readFile works even if handle is open (append-only)
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }

    const entries: WALEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as WALEntry);
      } catch {
        console.warn('[WAL] Skipping malformed line:', line);
      }
    }
    return entries;
  }

  async close(): Promise<void> {
    if (!this.handle) return;
    await this.handle.sync(); // final durability guarantee
    await this.handle.close();
    this.handle = null;
  }
}