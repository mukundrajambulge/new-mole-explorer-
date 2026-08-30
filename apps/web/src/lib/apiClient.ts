import type { BootstrapResponse, HealthResponse, StructureError, StructureLoadResult } from "@molecular/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly detail: StructureError | null, fallback: string) {
    super(detail?.message ?? fallback);
    this.name = "ApiClientError";
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    let detail: StructureError | null = null;
    try {
      const body = await response.json() as { error?: StructureError };
      detail = body.error ?? null;
    } catch {
      detail = null;
    }
    throw new ApiClientError(response.status, detail, `API request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const apiClient = {
  health: () => request<HealthResponse>("/health"),
  bootstrap: () => request<BootstrapResponse>("/bootstrap"),
  uploadStructure: (file: File) => {
    const body = new FormData();
    body.append("file", file, file.name);
    return request<StructureLoadResult>("/structures/upload", { method: "POST", body });
  },
  fetchRcsb: (pdbId: string) => request<StructureLoadResult>("/structures/rcsb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pdbId }),
  }),
};
