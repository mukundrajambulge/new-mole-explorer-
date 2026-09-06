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
export const sha256Canonical = (value: unknown): string => sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));

export const scientificHashFor = (payload: unknown): string => sha256Canonical({ schemaVersion: 1, profile: SCIENTIFIC_HASH_PROFILE, payload });

