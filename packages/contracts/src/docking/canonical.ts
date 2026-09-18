export const DOCKING_CANONICALIZATION_PROFILE = "ME_CANONICAL_CBOR_V1_1_0" as const;
export type DockingCanonicalizationProfile = typeof DOCKING_CANONICALIZATION_PROFILE;

export type CanonicalizationErrorCode =
  | "NONFINITE_CANONICAL_VALUE"
  | "UNSUPPORTED_CANONICAL_VALUE"
  | "INTEGER_OUT_OF_RANGE"
  | "INVALID_UTF8_SCALAR_SEQUENCE"
  | "INVALID_F64_BITS"
  | "INVALID_CBOR"
  | "NON_CANONICAL_CBOR"
  | "DUPLICATE_MAP_KEY";

export class CanonicalizationError extends TypeError {
  constructor(readonly code: CanonicalizationErrorCode, message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

const F64_TAG = "f64" as const;
export type F64Bits = Readonly<{ readonly tag: typeof F64_TAG; readonly bytes: Uint8Array }>;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const validateUnicodeScalars = (value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new CanonicalizationError("INVALID_UTF8_SCALAR_SEQUENCE", "Text contains an unpaired high surrogate.");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new CanonicalizationError("INVALID_UTF8_SCALAR_SEQUENCE", "Text contains an unpaired low surrogate.");
    }
  }
};

export const f64Bits = (value: number): F64Bits => {
  if (!Number.isFinite(value)) throw new CanonicalizationError("NONFINITE_CANONICAL_VALUE", "Ordinary-V1 canonical scientific floats must be finite.");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return Object.freeze({ tag: F64_TAG, bytes });
};

export const f64BitsFromBytes = (bytes: Uint8Array): F64Bits => {
  if (bytes.length !== 8) throw new CanonicalizationError("INVALID_F64_BITS", "F64Bits requires exactly eight bytes.");
  return Object.freeze({ tag: F64_TAG, bytes: new Uint8Array(bytes) });
};

export const f64Value = (bits: F64Bits): number => {
  if (bits.tag !== F64_TAG || bits.bytes.length !== 8) throw new CanonicalizationError("INVALID_F64_BITS", "Invalid F64Bits value.");
  return new DataView(bits.bytes.buffer, bits.bytes.byteOffset, bits.bytes.byteLength).getFloat64(0, false);
};

export const isF64Bits = (value: unknown): value is F64Bits => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { tag?: unknown; bytes?: unknown };
  return candidate.tag === F64_TAG && candidate.bytes instanceof Uint8Array && candidate.bytes.length === 8;
};

const unsignedHeader = (major: number, value: bigint): Uint8Array => {
  if (value < 0n) throw new CanonicalizationError("INTEGER_OUT_OF_RANGE", "CBOR unsigned values cannot be negative.");
  const prefix = major << 5;
  if (value < 24n) return Uint8Array.of(prefix | Number(value));
  if (value <= 0xffn) return Uint8Array.of(prefix | 24, Number(value));
  if (value <= 0xffffn) return Uint8Array.of(prefix | 25, Number(value >> 8n), Number(value & 0xffn));
  if (value <= 0xffffffffn) return Uint8Array.of(prefix | 26, Number((value >> 24n) & 0xffn), Number((value >> 16n) & 0xffn), Number((value >> 8n) & 0xffn), Number(value & 0xffn));
  if (value <= 0xffffffffffffffffn) {
    const bytes = new Uint8Array(9);
    bytes[0] = prefix | 27;
    let remaining = value;
    for (let index = 8; index >= 1; index -= 1) {
      bytes[index] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    return bytes;
  }
  throw new CanonicalizationError("INTEGER_OUT_OF_RANGE", "Canonical CBOR integers are limited to the RFC 8949 uint64 range.");
};

const bytewiseCompare = (left: Uint8Array, right: Uint8Array): number => {
  if (left.length !== right.length) return left.length - right.length;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return 0;
};

const encode = (value: unknown): Uint8Array => {
  if (value === null) return Uint8Array.of(0xf6);
  if (value === false) return Uint8Array.of(0xf4);
  if (value === true) return Uint8Array.of(0xf5);
  if (typeof value === "string") {
    validateUnicodeScalars(value);
    const bytes = new TextEncoder().encode(value);
    return concatBytes([unsignedHeader(3, BigInt(bytes.length)), bytes]);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new CanonicalizationError("NONFINITE_CANONICAL_VALUE", "Direct numeric canonical values must be finite.");
    if (!Number.isSafeInteger(value)) throw new CanonicalizationError("UNSUPPORTED_CANONICAL_VALUE", "Hash-bearing scientific non-integer numbers must be represented by F64Bits.");
    const integer = BigInt(value);
    return integer >= 0n ? unsignedHeader(0, integer) : unsignedHeader(1, -1n - integer);
  }
  if (typeof value === "bigint") return value >= 0n ? unsignedHeader(0, value) : unsignedHeader(1, -1n - value);
  if (value instanceof Uint8Array) return concatBytes([unsignedHeader(2, BigInt(value.length)), value]);
  if (isF64Bits(value)) return encode([F64_TAG, value.bytes]);
  if (Array.isArray(value)) {
    if (value.some((member) => member === undefined)) throw new CanonicalizationError("UNSUPPORTED_CANONICAL_VALUE", "Undefined array members are not canonical values.");
    return concatBytes([unsignedHeader(4, BigInt(value.length)), ...value.map(encode)]);
  }
  if (typeof value === "object" && value !== undefined) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new CanonicalizationError("UNSUPPORTED_CANONICAL_VALUE", "Canonical maps must be plain objects.");
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .map(([key, member]) => ({ key, keyBytes: encode(key), valueBytes: encode(member) }))
      .sort((left, right) => bytewiseCompare(left.keyBytes, right.keyBytes));
    return concatBytes([unsignedHeader(5, BigInt(entries.length)), ...entries.flatMap((entry) => [entry.keyBytes, entry.valueBytes])]);
  }
  throw new CanonicalizationError("UNSUPPORTED_CANONICAL_VALUE", `Canonical serialization does not support ${typeof value}.`);
};

export const encodeCanonicalCbor = (value: unknown): Uint8Array => encode(value);

type Cursor = { readonly bytes: Uint8Array; offset: number };

const readUnsigned = (cursor: Cursor, additional: number): bigint => {
  const read = (count: number): bigint => {
    if (cursor.offset + count > cursor.bytes.length) throw new CanonicalizationError("INVALID_CBOR", "Unexpected end of CBOR input.");
    let value = 0n;
    for (let index = 0; index < count; index += 1) value = (value << 8n) | BigInt(cursor.bytes[cursor.offset++]!);
    return value;
  };
  if (additional < 24) return BigInt(additional);
  if (additional === 24) return read(1);
  if (additional === 25) return read(2);
  if (additional === 26) return read(4);
  if (additional === 27) return read(8);
  throw new CanonicalizationError("INVALID_CBOR", "Indefinite-length and reserved CBOR encodings are not supported.");
};

const toLength = (value: bigint): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new CanonicalizationError("INTEGER_OUT_OF_RANGE", "CBOR length exceeds JavaScript safe integer range.");
  return Number(value);
};

const decodeOne = (cursor: Cursor): unknown => {
  if (cursor.offset >= cursor.bytes.length) throw new CanonicalizationError("INVALID_CBOR", "Unexpected end of CBOR input.");
  const initial = cursor.bytes[cursor.offset++]!;
  const major = initial >> 5;
  const additional = initial & 31;
  if (major === 0 || major === 1) {
    const unsigned = readUnsigned(cursor, additional);
    const signed = major === 0 ? unsigned : -1n - unsigned;
    return signed >= BigInt(Number.MIN_SAFE_INTEGER) && signed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(signed) : signed;
  }
  if (major === 2 || major === 3) {
    const length = toLength(readUnsigned(cursor, additional));
    if (cursor.offset + length > cursor.bytes.length) throw new CanonicalizationError("INVALID_CBOR", "Unexpected end of CBOR byte/text string.");
    const bytes = cursor.bytes.slice(cursor.offset, cursor.offset + length);
    cursor.offset += length;
    if (major === 2) return bytes;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      validateUnicodeScalars(text);
      return text;
    } catch {
      throw new CanonicalizationError("INVALID_UTF8_SCALAR_SEQUENCE", "CBOR text is not valid UTF-8.");
    }
  }
  if (major === 4) {
    const length = toLength(readUnsigned(cursor, additional));
    const result = Array.from({ length }, () => decodeOne(cursor));
    if (result.length === 2 && result[0] === F64_TAG && result[1] instanceof Uint8Array && result[1].length === 8) return f64BitsFromBytes(result[1]);
    return result;
  }
  if (major === 5) {
    const length = toLength(readUnsigned(cursor, additional));
    const result: Record<string, unknown> = {};
    for (let index = 0; index < length; index += 1) {
      const key = decodeOne(cursor);
      if (typeof key !== "string") throw new CanonicalizationError("INVALID_CBOR", "Canonical Mole Explorer maps require text keys.");
      if (Object.prototype.hasOwnProperty.call(result, key)) throw new CanonicalizationError("DUPLICATE_MAP_KEY", `Duplicate canonical map key ${key}.`);
      result[key] = decodeOne(cursor);
    }
    return result;
  }
  if (major === 7 && additional === 20) return false;
  if (major === 7 && additional === 21) return true;
  if (major === 7 && additional === 22) return null;
  throw new CanonicalizationError("INVALID_CBOR", "Unsupported CBOR major/simple value.");
};

export const decodeCanonicalCbor = (bytes: Uint8Array): unknown => {
  const cursor: Cursor = { bytes, offset: 0 };
  const value = decodeOne(cursor);
  if (cursor.offset !== bytes.length) throw new CanonicalizationError("INVALID_CBOR", "Trailing bytes follow the canonical CBOR value.");
  const canonical = encodeCanonicalCbor(value);
  if (!bytesEqual(canonical, bytes)) throw new CanonicalizationError("NON_CANONICAL_CBOR", "Input is valid but not in the ME_CANONICAL_CBOR_V1_1_0 canonical form.");
  return value;
};

export const canonicalCborHex = (value: unknown): string =>
  [...encodeCanonicalCbor(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
