import type { IncomingMessage } from "node:http";
import { MAX_STRUCTURE_BYTES, IngestionError } from "./ingestion.js";

export type MultipartFile = { filename: string; contentType: string; data: Buffer };

const readBody = async (request: IncomingMessage): Promise<Buffer> => {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > MAX_STRUCTURE_BYTES + 1_000_000) throw new IngestionError("PAYLOAD_TOO_LARGE", "Structure files must be 25 MB or smaller.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_STRUCTURE_BYTES + 1_000_000) throw new IngestionError("PAYLOAD_TOO_LARGE", "Structure files must be 25 MB or smaller.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

export const parseMultipartFile = async (request: IncomingMessage): Promise<MultipartFile> => {
  const contentType = request.headers["content-type"] ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new IngestionError("INVALID_INPUT", "The upload request was not a valid multipart form.");
  const boundary = Buffer.from(`--${boundaryMatch[1] ?? boundaryMatch[2]}`);
  const body = await readBody(request);
  const start = body.indexOf(boundary);
  if (start < 0) throw new IngestionError("INVALID_INPUT", "No uploaded structure file was found.");
  const headerStart = start + boundary.length + 2;
  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
  if (headerEnd < 0) throw new IngestionError("INVALID_INPUT", "The upload headers were incomplete.");
  const nextBoundary = body.indexOf(boundary, headerEnd + 4);
  if (nextBoundary < 0) throw new IngestionError("INVALID_INPUT", "The upload body was incomplete.");
  const headers = body.slice(headerStart, headerEnd).toString("utf8");
  const disposition = headers.match(/content-disposition:[^\r\n]*name="([^"]+)"[^\r\n]*filename="([^"]*)"/i);
  if (!disposition || disposition[1] !== "file") throw new IngestionError("INVALID_INPUT", "The upload did not contain a file field.");
  const dataEnd = nextBoundary >= 2 && body[nextBoundary - 2] === 13 && body[nextBoundary - 1] === 10 ? nextBoundary - 2 : nextBoundary;
  const data = body.slice(headerEnd + 4, dataEnd);
  if (data.length === 0) throw new IngestionError("INVALID_INPUT", "The uploaded file is empty.");
  const typeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
  return { filename: disposition[2], contentType: typeMatch?.[1]?.trim() ?? "application/octet-stream", data };
};
