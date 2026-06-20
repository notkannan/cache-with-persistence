import * as fs from 'fs';
import * as path from 'path';

export interface WALEntry {
    op: 'SET' | 'DEL';
    key: string;
    value?: string; // SET only
    ttlSeconds?: number; // SET only
    timestamp: number; // when the operation was performed
}

export class WAL {
    private filePath: string;

    constructor(dataDir: string) {
        fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'store.aof');
    }

    append(entry: WALEntry): void {
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.filePath, line, 'utf8');
    }

    readAll(): WALEntry[] {
        if (!fs.existsSync(this.filePath)) return [];
    
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const entries: WALEntry[] = [];
    
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue; // skip blank lines
          try {
            entries.push(JSON.parse(line) as WALEntry);
          } catch {
            console.warn('[WAL] Skipping malformed line:', line);
          }
        }
    
        return entries;
    }
}