import { createHash } from "node:crypto";

/**
 * Frozen native scientific hash profile.  The profile deliberately has a
 * small, explicit surface: object keys are sorted lexicographically, arrays
 * retain semantic order, undefined object members are omitted, and numbers
 * must be finite JSON numbers.  Scientific producers must include their
 * schema/profile marker in the value they hash.
 */
export const SCIENTIFIC_HASH_PROFILE = "molexplorer-scientific-canonical-json-v1";
export const SESSION_INTEGRITY_PROFILE = "molexplorer-session-canonical-json-v1";

type CanonicalValue = null | boolean | string | number | CanonicalValue[] | { [key: string]: CanonicalValue };

const canonicalize = (value: unknown): CanonicalValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical serialization accepts only finite numbers.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry) ?? null);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().flatMap((key) => {
      const next = canonicalize(record[key]);
      return next === undefined ? [] : [[key, next] as const];
    }));
  }
  throw new TypeError(`Canonical serialization does not support ${typeof value}.`);
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

export const sha256Bytes = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

/**
 * Hash canonical JSON without first materializing a second canonical object
 * and a full UTF-8 string. Large structures can contain hundreds of thousands
 * of atoms, so the old `canonicalJson` -> Buffer path created multi-gigabyte
 * transient allocations during scientific identity hashing.
 */
/**
 * Hash updates are deliberately buffered.  The canonical serializer visits
 * millions of primitive values for a large structure; calling Hash.update()
 * for every delimiter and scalar creates substantial JS/native boundary
 * overhead without changing the bytes being hashed.
 */
class CanonicalHashWriter {
  private readonly chunks: string[] = [];
  private pendingLength = 0;
  private readonly sortedKeyCache = new Map<number, Array<{ keys: readonly string[]; sorted: readonly string[] }>>();

  constructor(private readonly hash: ReturnType<typeof createHash>) {}

  write(value: string): void {
    this.chunks.push(value);
    this.pendingLength += value.length;
    if (this.pendingLength >= 64 * 1024) this.flush();
  }

  finish(): string {
    this.flush();
    return this.hash.digest("hex");
  }

  sortedKeys(record: Record<string, unknown>): readonly string[] {
    const keys = Object.keys(record);
    const bucket = this.sortedKeyCache.get(keys.length) ?? [];
    for (const entry of bucket) {
      if (entry.keys.length !== keys.length || entry.keys.some((key, index) => key !== keys[index])) continue;
      return entry.sorted;
    }
    const sorted = [...keys].sort();
    bucket.push({ keys, sorted });
    this.sortedKeyCache.set(keys.length, bucket);
    return sorted;
  }

  private flush(): void {
    if (this.chunks.length === 0) return;
    this.hash.update(this.chunks.join(""));
    this.chunks.length = 0;
    this.pendingLength = 0;
  }
}

const updateCanonicalHash = (writer: CanonicalHashWriter, value: unknown): void => {
  if (value === undefined) {
    writer.write("null");
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    writer.write(JSON.stringify(value));
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical serialization accepts only finite numbers.");
    writer.write(JSON.stringify(Object.is(value, -0) ? 0 : value));
    return;
  }
  if (Array.isArray(value)) {
    writer.write("[");
    value.forEach((entry, index) => {
      if (index > 0) writer.write(",");
      updateCanonicalHash(writer, entry);
    });
    writer.write("]");
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    writer.write("{");
    let first = true;
    for (const key of writer.sortedKeys(record)) {
      if (record[key] === undefined) continue;
      if (!first) writer.write(",");
      first = false;
      writer.write(JSON.stringify(key));
      writer.write(":");
      updateCanonicalHash(writer, record[key]);
    }
    writer.write("}");
    return;
  }
  throw new TypeError(`Canonical serialization does not support ${typeof value}.`);
};

export const sha256Canonical = (value: unknown): string => {
  const writer = new CanonicalHashWriter(createHash("sha256"));
  updateCanonicalHash(writer, value);
  return writer.finish();
};

export const scientificHashFor = (payload: unknown): string => sha256Canonical({ schemaVersion: 1, profile: SCIENTIFIC_HASH_PROFILE, payload });
