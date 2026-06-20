# @notkannan/cache-with-persistence

Redis-inspired in-memory key-value store with append-only file persistence.

## Install

```bash
npm install @notkannan/cache-with-persistence
```

## Usage

```ts
import { Store } from '@notkannan/cache-with-persistence';

const store = new Store('./data');

store.set('user:1', 'alice');
store.set('session', 'abc', 3600); // expires in 1 hour

store.get('user:1');    // 'alice'
store.del('user:1');    // true
store.exists('user:1'); // false
store.ttl('session');   // remaining ms, -1 if no expiry, -2 if missing
```

Operations are written to a WAL (`store.aof`) and replayed on startup.

## API

| Method | Description |
|--------|-------------|
| `new Store(dataDir?)` | Create store; defaults to `./data` |
| `set(key, value, ttlSeconds?)` | Set a key, optional TTL |
| `get(key)` | Get value, or `null` if missing/expired |
| `del(key)` | Delete key; returns `true` if it existed |
| `exists(key)` | Check if key exists |
| `ttl(key)` | Remaining ms, `-1` (no expiry), or `-2` (missing) |

## License

ISC
