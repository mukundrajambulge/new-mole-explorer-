import type { ZodTypeAny, z } from "zod";
import { IngestionError } from "../structures/ingestion.js";

const MAX_ECHO = 80;
const clip = (text: string) => (text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}...` : text);

/** Validate a request value; on failure throw a 400 naming the field and rule only (never the input value, never a path). */
export const parseOr400 = <S extends ZodTypeAny>(schema: S, value: unknown, what = "request"): z.output<S> => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = clip(issue?.path.map(String).join(".") || "(root)");
  const rule = clip(issue?.message ?? "invalid").replace(/[A-Za-z]:[\\/]\S*|\/\S+\/\S*/g, "<path>");
  throw new IngestionError("INVALID_INPUT", `Invalid ${what}: ${field}: ${rule}`, 400);
};

/** decodeURIComponent that answers 400 instead of throwing URIError. */
export const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new IngestionError("INVALID_INPUT", "The request path contains a malformed percent escape.", 400);
  }
};
