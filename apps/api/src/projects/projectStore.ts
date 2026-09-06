import { join } from "node:path";
import type { ProjectPresentationState, ProjectRecord, ProjectSaveRequest } from "@molecular/contracts";
import { SessionStore, type SessionSaveOptions, type SessionRevisionSummary } from "./sessionStore.js";

export const DEFAULT_PROJECT_PRESENTATION: ProjectPresentationState = {
  schemaVersion: 1,
  representation: "cartoon",
  layerVisibility: { protein: true, ligand: true, water: false, ions: true, other: true },
  color: { mode: "element" },
  background: { preset: "Black", color: "#05070a" },
  camera: { view: null, defaultView: null },
};

/** Compatibility facade: the legacy project API now persists SessionRevision nodes. */
export class ProjectStore {
  private readonly sessions: SessionStore;

  constructor(rootDir = process.env.MOLECULAR_DATA_DIR ?? join(process.cwd(), ".molecular-data")) {
    this.sessions = new SessionStore(rootDir);
  }

  create(name?: string): Promise<ProjectRecord> { return this.sessions.create(name); }
  open(id: string, revisionId?: string): Promise<ProjectRecord> { return this.sessions.open(id, revisionId); }
  save(id: string, request: ProjectSaveRequest, options?: SessionSaveOptions): Promise<ProjectRecord> { return this.sessions.save(id, request, options); }
  listRevisions(id: string): Promise<readonly SessionRevisionSummary[]> { return this.sessions.listRevisions(id); }
}
