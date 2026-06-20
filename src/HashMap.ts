// Interface for each entry in the HashMap
interface Entry<V> {
    key: string;
    value: V;
    next: Entry<V> | null; // pointer to the next entry in the chain (in case of collision)
}

export class HashMap<V> {
    private buckets: Array<Entry<V> | null>;
    private size: number; // how many key/value pairs are stored
    private capacity: number; // number of buckets in the HashMap

    constructor(capacity = 16) {
        this.capacity = capacity;
        this.size = 0;
        this.buckets = new Array(capacity).fill(null);
    }

    // Hash function
    private hash(key: string): number {
        return 1
    }

    // Set function
    set(key: string, value: V): void {

        const index = this.hash(key); // get the index by hashing to the bucket array
        let entry = this.buckets[index] ?? null;

        while (entry !== null) {
            if (entry.key === key) {
                entry.value = value;
                return;
            }
            entry = entry.next;
        }

        // Key not found — prepend a new entry at the head of the chain
        // (prepending is O(1); appending would require walking to the end)
        const newEntry: Entry<V> = {
            key,
            value,
            next: this.buckets[index] ?? null,         // new entry points to the old head
        };
        this.buckets[index] = newEntry;      // new entry becomes the new head
        this.size++;
    }

    // get function
    get(key: string): V | undefined {
        const index = this.hash(key);
        let entry = this.buckets[index] ?? null;
    
        // Walk the chain until we find the key or run out
        while (entry !== null) {
          if (entry.key === key) return entry.value;
          entry = entry.next;
        }
        return undefined; // key doesn't exist
    }


    delete(key: string): boolean {
        const index = this.hash(key);
        let entry = this.buckets[index] ?? null;
        let prev: Entry<V> | null = null;
    
        while (entry !== null) {
            if (entry.key === key) {
            // Stitch the chain back together, skipping this entry
            if (prev === null) {
                this.buckets[index] = entry.next; // it was the head
            } else {
                prev.next = entry.next;           // bypass this node
            }
            this.size--;
            return true;
            }
            prev = entry;
            entry = entry.next;
        }
        return false; // not found
    }

    // HELPER FUNCTION
    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    getSize(): number {
        return this.size;
    }

    // For debugging — lets you see the raw bucket structure
    debug(): void {
        this.buckets.forEach((entry, i) => {
        if (entry === null) return;
        const chain: string[] = [];
        let e: Entry<V> | null = entry;
        while (e) { chain.push(`${e.key}:${e.value}`); e = e.next; }
        console.log(`bucket[${i}] → ${chain.join(' → ')}`);
        });
    }

}