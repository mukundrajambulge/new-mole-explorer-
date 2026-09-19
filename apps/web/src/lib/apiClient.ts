import type { BootstrapResponse, HealthResponse, ProjectRecord, ProjectSaveRequest, StructureLoadResult } from "@molecular/contracts";
import { type ApiRequestOptions, requestJson } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export { ApiClientError } from "./apiRequest";

export const apiClient = {
  health: (options?: ApiRequestOptions) => requestJson<HealthResponse>(apiBaseUrl, "/health", {}, options),
  bootstrap: (options?: ApiRequestOptions) => requestJson<BootstrapResponse>(apiBaseUrl, "/bootstrap", {}, options),
  uploadStructure: (file: File, options?: ApiRequestOptions) => {
    const body = new FormData();
    body.append("file", file, file.name);
    return requestJson<StructureLoadResult>(apiBaseUrl, "/structures/upload", { method: "POST", body }, options);
  },
  fetchRcsb: (pdbId: string, options?: ApiRequestOptions) => requestJson<StructureLoadResult>(apiBaseUrl, "/structures/rcsb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pdbId }),
  }, options),
  createProject: (name?: string, options?: ApiRequestOptions) => requestJson<ProjectRecord>(apiBaseUrl, "/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  }, options),
  openProject: (id: string, options?: ApiRequestOptions) => requestJson<ProjectRecord>(apiBaseUrl, `/projects/${encodeURIComponent(id)}`, {}, options),
  saveProject: (id: string, body: ProjectSaveRequest, options?: ApiRequestOptions) => requestJson<ProjectRecord>(apiBaseUrl, `/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, options),
};
