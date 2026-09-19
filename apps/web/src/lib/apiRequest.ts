export type ApiRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiClientErrorKind = "HTTP" | "TIMEOUT" | "ABORTED";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: { code?: string; message?: string } | null,
    fallback: string,
    public readonly kind: ApiClientErrorKind = "HTTP",
  ) {
    super(detail?.message ?? fallback);
    this.name = "ApiClientError";
  }
}

export const DEFAULT_API_TIMEOUT_MS = 30_000;

export const isApiCancellation = (error: unknown): boolean => error instanceof ApiClientError && error.kind === "ABORTED";

export const requestJson = async <T>(apiBaseUrl: string, path: string, init: RequestInit = {}, options: ApiRequestOptions = {}): Promise<T> => {
  const controller = new AbortController();
  const callerSignal = options.signal ?? init.signal;
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      let detail: { code?: string; message?: string } | null = null;
      try { const body = await response.json() as { error?: { code?: string; message?: string } }; detail = body.error ?? null; } catch { detail = null; }
      throw new ApiClientError(response.status, detail, `API request failed: ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (timedOut) throw new ApiClientError(408, null, `The API request timed out after ${timeoutMs} ms.`, "TIMEOUT");
    if (callerSignal?.aborted || controller.signal.aborted) throw new ApiClientError(0, null, "The API request was cancelled.", "ABORTED");
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
};
