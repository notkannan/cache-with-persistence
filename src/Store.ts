import * as fs from 'fs';
import { HashMap } from './HashMap.js'
import { WAL, type WALEntry } from './WAL.js'

interface StoreEntry {
  value: string;
  expiresAt: number | null;  // Unix ms timestamp, or null if no expiry
}

export class Store {
  private map: HashMap<StoreEntry>;
  private wal: WAL;

  constructor(dataDir: string ='./data') {
    this.map = new HashMap<StoreEntry>();
    this.wal = new WAL(dataDir);


    this.recover();
  }

  private recover(): void {
    const entries = this.wal.readAll();
    if (entries.length === 0) return; // clean WAL file

    for(const entry of entries) {
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

  // SET key value [EX seconds]
  set(key: string, value: string, ttlSeconds?: number): void {
    
    this.wal.append({ 
      op: 'SET', 
      key, 
      value, 
      timestamp: Date.now(),
      ...(ttlSeconds !== undefined && { ttlSeconds })
    });

    const expiresAt = ttlSeconds
      ? Date.now() + ttlSeconds * 1000
      : null;

    this.map.set(key, { value, expiresAt });
  }

  // GET key → returns the value, or null if missing/expired
  get(key: string): string | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    // Lazy expiry — we check on read, not on a background timer
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key); // clean up expired key
      return null;
    }

    return entry.value;
  }

  // DEL key → returns true if deleted, false if key didn't exist
  del(key: string): boolean {
    this.wal.append({ op: 'DEL', key, timestamp: Date.now() });
    return this.map.delete(key);
  }

  // EXISTS key
  exists(key: string): boolean {
    return this.get(key) !== null; // reuses expiry logic from get()
  }

  // TTL key → remaining milliseconds, -1 if no expiry, -2 if not found
  ttl(key: string): number {
    const entry = this.map.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }
}