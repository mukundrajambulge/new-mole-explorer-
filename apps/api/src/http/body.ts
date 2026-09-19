import type { IncomingMessage } from "node:http";
import { IngestionError } from "../structures/ingestion.js";

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const MAX_JSON_BODY_BYTES = positiveInteger(process.env.MOLECULAR_MAX_JSON_BODY_BYTES, 32 * 1024 * 1024);

export const readLimitedRequestBody = async (request: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<Buffer> => {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > maxBytes) throw new IngestionError("PAYLOAD_TOO_LARGE", `Request body exceeds the ${maxBytes} byte limit.`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new IngestionError("PAYLOAD_TOO_LARGE", `Request body exceeds the ${maxBytes} byte limit.`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

export const readJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse((await readLimitedRequestBody(request)).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError("INVALID_INPUT", "The request body was not a valid JSON object.");
  }
};
