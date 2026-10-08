import type { IncomingMessage } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { IngestionError } from "./ingestion.js";

/** Room for the multipart envelope (boundaries, part headers) on top of the file cap. */
export const MULTIPART_ENVELOPE_BYTES = 64 * 1024;
const PART_HEADER_LIMIT = 16 * 1024;
const SNIFF_BYTES = 64 * 1024;

const mib = (bytes: number) => `${Math.floor(bytes / (1024 * 1024))} MiB`;
const tooLarge = (maxFileBytes: number) => new IngestionError("PAYLOAD_TOO_LARGE", `Structure uploads must be ${mib(maxFileBytes)} or smaller.`);
const invalid = (message: string) => new IngestionError("INVALID_INPUT", message);

/**
 * Feed request chunks to onChunk without ever destroying the request: on failure the
 * rest of the body is discarded (not buffered) so the error reply still reaches the client.
 * An async onChunk pauses the request until it settles (disk backpressure).
 */
export const consumeRequest = (request: IncomingMessage, onChunk: (chunk: Buffer) => void | Promise<void>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    let pending: Promise<void> = Promise.resolve();
    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("close", onClose);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      request.on("error", () => undefined);
      request.resume();
      reject(error);
    };
    const onData = (raw: Buffer | string) => {
      if (settled) return;
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      let result: void | Promise<void>;
      try {
        result = onChunk(chunk);
      } catch (error) {
        fail(error);
        return;
      }
      if (result) {
        request.pause();
        pending = result.then(() => { if (!settled) request.resume(); }, (error: unknown) => { fail(error); });
      }
    };
    let ended = false;
    const onEnd = () => {
      ended = true;
      void pending.then(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      });
    };
    // A client that disconnects mid-body is a bad request, not a server fault.
    const onError = () => fail(invalid("The request body was incomplete."));
    const onClose = () => { if (!ended) onError(); };
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
    request.on("close", onClose);
  });

/** Reject before reading anything when the declared body length is already over the cap. */
export const assertDeclaredLength = (request: IncomingMessage, max: number, error: () => Error) => {
  const declared = request.headers["content-length"];
  if (declared !== undefined && Number(declared) > max) throw error();
};

export type ReceivedUpload = {
  filename: string;
  contentType: string;
  /** Server-chosen temp file holding exactly the uploaded bytes. */
  path: string;
  size: number;
  /** The leading bytes contain NUL, so this is not a text structure file. */
  binary: boolean;
  dispose: () => Promise<void>;
};

export type UploadLimits = { maxFileBytes: number; tempDir: string };

type PartHeaders = { name?: string; filename?: string; contentType: string };

const parsePartHeaders = (text: string): PartHeaders => {
  const lines = text.split("\r\n");
  const disposition = lines.find((line) => /^content-disposition\s*:/i.test(line)) ?? "";
  const name = /(?:^|;)\s*name="([^"]*)"/i.exec(disposition.slice(disposition.indexOf(":") + 1))?.[1];
  const filename = /(?:^|;)\s*filename="([^"]*)"/i.exec(disposition.slice(disposition.indexOf(":") + 1))?.[1];
  const typeLine = lines.find((line) => /^content-type\s*:/i.test(line));
  return { name, filename, contentType: typeLine ? typeLine.slice(typeLine.indexOf(":") + 1).trim() : "application/octet-stream" };
};

const writeChunk = async (stream: WriteStream, chunk: Buffer) => {
  if (chunk.length === 0) return;
  if (!stream.write(chunk)) await once(stream, "drain");
};

/**
 * Stream the single `file` field of a multipart/form-data body to a temp file. Memory use is
 * bounded by the part-header limit and one network chunk; the file is never held in memory.
 */
export const receiveMultipartFile = async (request: IncomingMessage, limits: UploadLimits): Promise<ReceivedUpload> => {
  const contentType = request.headers["content-type"] ?? "";
  const boundaryMatch = /^multipart\/form-data\s*;.*\bboundary=(?:"([^"]{1,70})"|([^\s;"]{1,70}))/i.exec(contentType);
  if (!boundaryMatch) throw invalid("The upload request was not a valid multipart form.");
  const maxBodyBytes = limits.maxFileBytes + MULTIPART_ENVELOPE_BYTES;
  assertDeclaredLength(request, maxBodyBytes, () => tooLarge(limits.maxFileBytes));

  const delimiter = Buffer.from(`\r\n--${boundaryMatch[1] ?? boundaryMatch[2]}`);
  const headerEnd = Buffer.from("\r\n\r\n");
  const keep = delimiter.length - 1;
  await mkdir(limits.tempDir, { recursive: true });
  const path = join(limits.tempDir, `${randomUUID()}.upload`);

  let out: WriteStream | undefined;
  let outError: unknown;
  let found: PartHeaders | undefined;
  let state: "seek" | "boundaryTail" | "headers" | "file" | "done" = "seek";
  // A leading CRLF lets the first boundary match the same delimiter as every later one.
  let pending: Buffer = Buffer.from("\r\n");
  let total = 0;
  let size = 0;
  let sniff = 0;
  let binary = false;
  let fileDone = false;

  const writeFileBytes = async (bytes: Buffer) => {
    if (bytes.length === 0) return;
    size += bytes.length;
    if (size > limits.maxFileBytes) throw tooLarge(limits.maxFileBytes);
    if (sniff < SNIFF_BYTES) {
      const head = bytes.subarray(0, SNIFF_BYTES - sniff);
      if (head.includes(0)) binary = true;
      sniff += head.length;
    }
    if (outError) throw outError;
    await writeChunk(out!, bytes);
  };

  const advance = async () => {
    for (;;) {
      if (state === "seek") {
        const index = pending.indexOf(delimiter);
        if (index < 0) {
          if (pending.length > keep) pending = pending.subarray(pending.length - keep);
          return;
        }
        pending = pending.subarray(index + delimiter.length);
        state = "boundaryTail";
      } else if (state === "boundaryTail") {
        if (pending.length < 2) return;
        if (pending[0] === 0x2d && pending[1] === 0x2d) {
          state = "done";
          pending = Buffer.alloc(0);
          return;
        }
        const lineEnd = pending.indexOf("\r\n");
        if (lineEnd < 0) {
          if (pending.length > 256) throw invalid("The upload body was malformed.");
          return;
        }
        // RFC 2046 allows linear whitespace after a boundary.
        if (!/^[ \t]*$/.test(pending.subarray(0, lineEnd).toString("latin1"))) throw invalid("The upload body was malformed.");
        pending = pending.subarray(lineEnd + 2);
        state = "headers";
      } else if (state === "headers") {
        const index = pending.indexOf(headerEnd);
        if (index < 0) {
          if (pending.length > PART_HEADER_LIMIT) throw invalid("The upload headers were too large.");
          return;
        }
        if (index > PART_HEADER_LIMIT) throw invalid("The upload headers were too large.");
        const headers = parsePartHeaders(pending.subarray(0, index).toString("utf8"));
        pending = pending.subarray(index + headerEnd.length);
        if (!found && headers.name === "file" && headers.filename !== undefined) {
          found = headers;
          out = createWriteStream(path, { flags: "wx", mode: 0o600 });
          out.on("error", (error) => { outError = error; });
          state = "file";
        } else {
          state = "seek";
        }
      } else if (state === "file") {
        const index = pending.indexOf(delimiter);
        if (index < 0) {
          if (pending.length > keep) {
            const flush = pending.subarray(0, pending.length - keep);
            pending = pending.subarray(pending.length - keep);
            await writeFileBytes(flush);
          }
          return;
        }
        const last = pending.subarray(0, index);
        pending = pending.subarray(index + delimiter.length);
        state = "boundaryTail";
        await writeFileBytes(last);
        const stream = out!;
        stream.end();
        if (!stream.writableFinished && !outError) await once(stream, "finish");
        fileDone = true;
      } else {
        pending = Buffer.alloc(0);
        return;
      }
    }
  };

  const dispose = async () => {
    // Windows cannot unlink an open file: wait for the descriptor to close first.
    if (out && !out.closed) {
      const closed = once(out, "close").catch(() => undefined);
      out.destroy();
      await closed;
    }
    await unlink(path).catch(() => undefined);
  };

  try {
    await consumeRequest(request, (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) throw tooLarge(limits.maxFileBytes);
      if (state === "done") return;
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      return advance();
    });
    if (outError) throw outError;
    if (!found) throw invalid("The upload did not contain a file field.");
    if (!fileDone) throw invalid("The upload body was incomplete.");
    if (size === 0) throw invalid("The uploaded file is empty.");
    return { filename: found.filename!, contentType: found.contentType, path, size, binary, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};

export type UploadText = { content: string; sha256: string; byteLength: number };

/**
 * Decode an uploaded text file in one streaming pass that also hashes the exact bytes on disk.
 * The whole file is never held as a Buffer; only the decoded text the parsers need is kept.
 * Callers cap the file well below V8's ~512 Mi-character string limit.
 */
export const readUploadText = async (path: string): Promise<UploadText> => {
  const hash = createHash("sha256");
  const decoder = new StringDecoder("utf8");
  const parts: string[] = [];
  let byteLength = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 1024 * 1024 })) {
    const bytes = chunk as Buffer;
    byteLength += bytes.length;
    hash.update(bytes);
    parts.push(decoder.write(bytes));
  }
  parts.push(decoder.end());
  const content = parts.join("");
  parts.length = 0;
  return { content, sha256: hash.digest("hex"), byteLength };
};
