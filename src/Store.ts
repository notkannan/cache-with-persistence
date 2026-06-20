// src/Store.ts
import { HashMap } from './HashMap.js';
import { WAL, type WALEntry } from './WAL.js';

interface StoreEntry {
  value: string;
  expiresAt: number | null;
}

export interface StoreOptions {
  dataDir?: string;
  syncOnWrite?: boolean; // pass through to WAL
}

type StoreState = 'open' | 'closing' | 'closed';

export class Store {
  private map = new HashMap<StoreEntry>();
  private wal: WAL;
  private state: StoreState = 'open';
  private writeChain: Promise<void> = Promise.resolve();

  /** Private — use Store.open() */
  private constructor(wal: WAL) {
    this.wal = wal;
  }

  /** Create store and replay WAL (async startup) */
  static async open(options: StoreOptions = {}): Promise<Store> {
    const dataDir = options.dataDir ?? './data';
    const wal = await WAL.open(dataDir, { ...(options.syncOnWrite !== undefined && { syncOnWrite: options.syncOnWrite }) });
    const store = new Store(wal);
    await store.recover();
    return store;
  }

  private async recover(): Promise<void> {
    const entries = await this.wal.readAll();
    for (const entry of entries) {
      if (entry.op === 'SET') {
        const expiresAt = entry.ttlSeconds
          ? entry.timestamp + entry.ttlSeconds * 1000
          : null;
        if (expiresAt !== null && Date.now() > expiresAt) continue;
        this.map.set(entry.key, { value: entry.value!, expiresAt });
      } else if (entry.op === 'DEL') {
        this.map.delete(entry.key);
      }
    }
  }

  private assertOpen(): void {
    if (this.state !== 'open') {
      throw new Error(`Store is ${this.state}`);
    }
  }

  private enqueueWrite(task: () => Promise<void>): Promise<void> {
    this.assertOpen();
    const next = this.writeChain.then(task);
    // Keep chain alive even if one write fails
    this.writeChain = next.catch(() => {});
    return next;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: WALEntry = {
      op: 'SET',
      key,
      value,
      timestamp: Date.now(),
      ...(ttlSeconds !== undefined && { ttlSeconds }),
    };

    await this.enqueueWrite(async () => {
      await this.wal.append(entry); // durable first

      const expiresAt = ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : null;
      this.map.set(key, { value, expiresAt });
    });
  }

  /** Reads stay sync — memory only */
  get(key: string): string | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<boolean> {
    let deleted = false;

    await this.enqueueWrite(async () => {
      await this.wal.append({ op: 'DEL', key, timestamp: Date.now() });
      deleted = this.map.delete(key);
    });

    return deleted;
  }

  exists(key: string): boolean {
    return this.get(key) !== null;
  }

  ttl(key: string): number {
    const entry = this.map.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  /** Wait for all pending writes, then fsync */
  async flush(): Promise<void> {
    await this.writeChain;
    await this.wal.flush();
  }

  /** Drain writes, fsync, close file handle */
  async close(): Promise<void> {
    if (this.state === 'closed') return;

    this.state = 'closing';
    await this.writeChain;  // wait for in-flight set/del
    await this.wal.close();
    this.state = 'closed';
  }
}