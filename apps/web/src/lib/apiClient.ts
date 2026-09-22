import type { BootstrapResponse, CanonicalCommand, CommandJob, CommandResult, D2SearchRegionV1, D2ValidationStatus, HealthResponse, JsonRecord, ProjectRecord, ProjectSaveRequest, StructureError, StructureLoadResult } from "@molecular/contracts";
import { hydrateCompactLoadResult } from "../structures/compactCanonical";

export type SessionRevisionSummary = { sessionRevisionId: string; parentSessionRevisionIds: readonly string[]; savedAt: string; revisionType: "USER_CHECKPOINT" | "RECOVERY" | "AUTOSAVE" | "MIGRATION"; name: string };

export type D2AdaptationResponse = {
  status: D2ValidationStatus;
  diagnostics: readonly { code: string; severity: "ERROR" | "WARNING"; blocking: boolean; message: string; path?: string; objectRef?: string }[];
  value?: {
    sourceFormat: string;
    sourceArtifactId: string;
    sourceArtifactDigest: string;
    identity?: { identityId: string; graphRevisionDigest: string; digest: string };
    graph?: { revisionId: string; atoms: readonly unknown[]; bonds: readonly unknown[]; components: readonly { componentId: string; role: string; atomUids: readonly string[] }[]; digest: string };
    chemicalState?: { stateId: string; resolution: string; protonationStatus: string; tautomerStatus: string; digest: string };
    coordinateStates: readonly { stateId: string; coordinateFrame: string; digest: string }[];
    authoritativeForMolecularIdentity: boolean;
    executionRepresentation?: { format: string; authoritativeForMolecularIdentity: false; artifactByteDigest: string };
    diagnostics: readonly string[];
  };
};

export type D2SearchRegionResponse = {
  status: D2ValidationStatus;
  diagnostics: readonly { code: string; severity: "ERROR" | "WARNING"; blocking: boolean; message: string; path?: string; objectRef?: string }[];
  value?: D2SearchRegionV1;
  presentation?: { center: readonly number[]; size: readonly number[]; min: readonly number[]; max: readonly number[]; units: "ANGSTROM"; coordinateFrame: string; digest: string };
};

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
  const payload = (await response.json()) as T;
  if (payload && typeof payload === "object" && "structure" in payload && (payload as { structure?: unknown }).structure) return hydrateCompactLoadResult(payload as unknown as StructureLoadResult) as T;
  return payload;
};

export const apiClient = {
  health: () => request<HealthResponse>("/health"),
  bootstrap: () => request<BootstrapResponse>("/bootstrap"),
  uploadStructure: (file: File, parentExportArtifactId?: string) => {
    const body = new FormData();
    body.append("file", file, file.name);
    return request<StructureLoadResult>("/structures/upload", { method: "POST", ...(parentExportArtifactId ? { headers: { "x-parent-export-artifact-id": parentExportArtifactId } } : {}), body });
  },
  fetchRcsb: (pdbId: string) => request<StructureLoadResult>("/structures/rcsb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pdbId }),
  }),
  createProject: (name?: string) => request<ProjectRecord>("/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  }),
  openProject: (id: string) => request<ProjectRecord>(`/projects/${encodeURIComponent(id)}`),
  openProjectRevision: (id: string, revisionId: string) => request<ProjectRecord>(`/projects/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`),
  listProjectRevisions: (id: string) => request<{ revisions: readonly SessionRevisionSummary[] }>(`/projects/${encodeURIComponent(id)}/revisions`),
  saveProject: (id: string, body: ProjectSaveRequest) => request<ProjectRecord>(`/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }),
  commandRegistry: () => request<JsonRecord>("/commands/registry"),
  executeCommand: (body: { rawCommand?: string; command?: CanonicalCommand; surface?: "GUI" | "CONSOLE" | "REST" | "SDK" | "MACRO" | "BATCH"; requestedMode?: "SYNC" | "ASYNC" | "AUTO"; correlationId?: string; idempotencyKey?: string }) => request<CommandResult>("/commands", {
    method: "POST",
    headers: { "content-type": "application/json", ...(body.idempotencyKey ? { "x-idempotency-key": body.idempotencyKey } : {}), ...(body.correlationId ? { "x-correlation-id": body.correlationId } : {}) },
    body: JSON.stringify(body),
  }),
  executeCanonicalCommand: (command: CanonicalCommand) => request<CommandResult>("/v1/commands/execute", {
    method: "POST",
    headers: { "content-type": "application/json", ...(command.idempotencyKey ? { "x-idempotency-key": command.idempotencyKey } : {}), ...(command.correlationId ? { "x-correlation-id": command.correlationId } : {}) },
    body: JSON.stringify({ command }),
  }),
  executeCommandBatch: (body: { rawCommand: string; requestedMode?: "SYNC" | "ASYNC" | "AUTO"; correlationId?: string; idempotencyKey?: string }) => request<CommandResult>("/commands/batch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(body.idempotencyKey ? { "x-idempotency-key": body.idempotencyKey } : {}), ...(body.correlationId ? { "x-correlation-id": body.correlationId } : {}) },
    body: JSON.stringify(body),
  }),
  commandHistory: () => request<{ records: readonly JsonRecord[] }>("/commands/history"),
  commandJob: (jobId: string) => request<CommandJob>(`/commands/jobs/${encodeURIComponent(jobId)}`),
  cancelCommandJob: (jobId: string) => request<CommandJob>(`/commands/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }),
  retryCommandJob: (jobId: string) => request<CommandJob>(`/commands/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" }),
  replayCommand: (actionRecordId: string) => request<CommandResult>(`/commands/history/${encodeURIComponent(actionRecordId)}/replay`, { method: "POST" }),
  d2AdaptStructure: (body: { structure: StructureLoadResult["structure"]; sourceArtifact?: StructureLoadResult["sourceArtifact"] }) => request<D2AdaptationResponse>("/docking/d2/adapt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }),
  d2CommitSearchRegion: (input: unknown) => request<D2SearchRegionResponse>("/docking/d2/search-region", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  }),
};
