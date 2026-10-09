/**
 * Server-sent events over fetch + ReadableStream (task 5.7c). EventSource cannot send the x-mole-token header,
 * so the docking job stream is read with fetch and parsed here (WHATWG event-stream rules: id, event, data, retry,
 * ":" comments, blank-line dispatch). The line buffer is capped so a hostile stream cannot grow memory unbounded.
 */

export type SseMessage = Readonly<{ id: string | undefined; event: string; data: string }>;

export const SSE_MAX_LINE_CHARS = 256 * 1024;

export class SseHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "SseHttpError";
  }
}

/** Incremental parser: feed decoded text chunks, receive dispatched messages. */
export const createSseParser = (onMessage: (m: SseMessage) => void, onRetry?: (ms: number) => void) => {
  let buffer = "";
  let data: string[] = [];
  let event = "";
  let lastId: string | undefined;
  let pendingCr = false;

  const dispatch = () => {
    if (data.length > 0) onMessage({ id: lastId, event: event || "message", data: data.join("\n") });
    data = [];
    event = "";
  };
  const line = (l: string) => {
    if (l === "") return dispatch();
    if (l.startsWith(":")) return;
    const colon = l.indexOf(":");
    const field = colon < 0 ? l : l.slice(0, colon);
    let value = colon < 0 ? "" : l.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") data.push(value);
    else if (field === "event") event = value;
    else if (field === "id") { if (!value.includes("\0")) lastId = value; }
    else if (field === "retry") { if (/^\d{1,7}$/.test(value)) onRetry?.(Number(value)); }
  };

  return {
    push(chunk: string) {
      let text = chunk;
      // A CR at the end of the previous chunk may be the first half of CRLF.
      if (pendingCr && text.startsWith("\n")) text = text.slice(1);
      pendingCr = false;
      buffer += text;
      let start = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const c = buffer.charCodeAt(i);
        if (c !== 10 && c !== 13) continue;
        line(buffer.slice(start, i));
        if (c === 13) {
          if (i + 1 < buffer.length) { if (buffer.charCodeAt(i + 1) === 10) i += 1; }
          else pendingCr = true;
        }
        start = i + 1;
      }
      buffer = buffer.slice(start);
      if (buffer.length > SSE_MAX_LINE_CHARS) throw new Error("The event stream sent a line that is too long.");
    },
    /** The id of the last event seen (for Last-Event-ID on reconnect). */
    lastEventId: () => lastId,
  };
};

export type ReadSseOptions = Readonly<{
  signal: AbortSignal;
  lastEventId?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  onRetry?: (ms: number) => void;
}>;

/**
 * Opens one stream and reads it until the server closes it. Resolves with the last event id seen; rejects on a
 * non-2xx answer (SseHttpError), a network error or abort (AbortError is passed through untouched).
 */
export const readSse = async (url: string, onMessage: (m: SseMessage) => void, o: ReadSseOptions): Promise<string | undefined> => {
  const f = o.fetchImpl ?? fetch;
  const headers: Record<string, string> = { accept: "text/event-stream", ...(o.headers ?? {}) };
  if (o.lastEventId !== undefined) headers["last-event-id"] = o.lastEventId;
  const response = await f(url, { signal: o.signal, headers, cache: "no-store" });
  if (!response.ok) {
    let message = `The event stream answered HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: { message?: unknown } | string };
      const m = typeof body.error === "string" ? body.error : body.error?.message;
      if (typeof m === "string" && m) message = `${m.slice(0, 300)} (HTTP ${response.status})`;
    } catch {
      // keep the generic message
    }
    throw new SseHttpError(response.status, message);
  }
  if (!response.body) throw new SseHttpError(response.status, "The event stream has no body.");
  const parser = createSseParser(onMessage, o.onRetry);
  if (o.lastEventId !== undefined) parser.push(`id: ${o.lastEventId}\n`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  o.signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (o.signal.aborted) throw new DOMException("aborted", "AbortError");
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    return parser.lastEventId();
  } finally {
    o.signal.removeEventListener("abort", onAbort);
    reader.releaseLock?.();
  }
};
