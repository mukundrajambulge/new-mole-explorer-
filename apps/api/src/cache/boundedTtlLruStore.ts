export type BoundedTtlLruStoreOptions<T> = {
  maxEntries: number;
  maxBytes: number;
  ttlMs: number;
  sizeOf: (value: T) => number;
  onEvict?: (value: T) => void;
};

type Entry<T> = {
  value: T;
  bytes: number;
  expiresAt: number;
};

/** A small in-process cache with explicit count, byte, and lifetime bounds. */
export class BoundedTtlLruStore<K, T> {
  private readonly entries = new Map<K, Entry<T>>();
  private totalBytes = 0;

  constructor(private readonly options: BoundedTtlLruStoreOptions<T>) {
    if (options.maxEntries < 1 || options.maxBytes < 1 || options.ttlMs < 1) throw new Error("Bounded cache limits must be positive.");
  }

  get(key: K, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: T, now = Date.now()): boolean {
    this.sweep(now);
    const bytes = Math.max(0, Math.floor(this.options.sizeOf(value)));
    if (bytes > this.options.maxBytes) {
      this.delete(key);
      return false;
    }
    this.delete(key);
    this.entries.set(key, { value, bytes, expiresAt: now + this.options.ttlMs });
    this.totalBytes += bytes;
    this.evictToBounds();
    return this.entries.has(key);
  }

  delete(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.totalBytes -= entry.bytes;
    this.options.onEvict?.(entry.value);
    return true;
  }

  clear(): void {
    for (const key of this.entries.keys()) this.delete(key);
  }

  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number { return this.entries.size; }
  get bytes(): number { return this.totalBytes; }

  private evictToBounds(): void {
    while (this.entries.size > this.options.maxEntries || this.totalBytes > this.options.maxBytes) {
      const oldest = this.entries.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }
}
