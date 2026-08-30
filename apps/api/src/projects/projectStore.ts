import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectPresentationState, ProjectRecord, ProjectSaveRequest } from "@molecular/contracts";
import { IngestionError } from "../structures/ingestion.js";

export const DEFAULT_PROJECT_PRESENTATION: ProjectPresentationState = {
  schemaVersion: 1,
  representation: "cartoon",
  layerVisibility: { protein: true, ligand: true, water: false, ions: true, other: true },
  color: { mode: "element" },
  background: { preset: "Black", color: "#05070a" },
  camera: { view: null, defaultView: null },
};

const safeProjectId = (id: string): string => {
  if (!/^project_[a-f0-9-]+$/i.test(id)) throw new IngestionError("PROJECT_INVALID", "The project ID is invalid.");
  return id;
};

export class ProjectStore {
  private readonly rootDir: string;

  constructor(rootDir = process.env.MOLECULAR_DATA_DIR ?? join(process.cwd(), ".molecular-data")) {
    this.rootDir = rootDir;
  }

  async create(name = "Untitled Project"): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: `project_${randomUUID()}`,
      name: name.trim() || "Untitled Project",
      schemaVersion: 1,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      structure: null,
      presentation: DEFAULT_PROJECT_PRESENTATION,
    };
    await this.write(project);
    return project;
  }

  async open(id: string): Promise<ProjectRecord> {
    const path = join(this.rootDir, `${safeProjectId(id)}.json`);
    try {
      return JSON.parse(await readFile(path, "utf8")) as ProjectRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new IngestionError("PROJECT_NOT_FOUND", `Project ${id} was not found.`, 404);
      throw new IngestionError("PROJECT_INVALID", "The saved project manifest could not be read.");
    }
  }

  async save(id: string, request: ProjectSaveRequest): Promise<ProjectRecord> {
    const current = await this.open(id);
    if (!request.presentation || request.presentation.schemaVersion !== 1 || !request.presentation.layerVisibility || !request.presentation.camera) throw new IngestionError("PROJECT_INVALID", "The project presentation state is invalid.");
    if (request.expectedRevision !== undefined && request.expectedRevision !== current.revision) throw new IngestionError("PROJECT_INVALID", "The project changed before it could be saved; reload it before saving again.", 409);
    const project: ProjectRecord = {
      ...current,
      name: request.name?.trim() || current.name,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      structure: request.structure,
      presentation: request.presentation,
    };
    await this.write(project);
    return project;
  }

  private async write(project: ProjectRecord): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const path = join(this.rootDir, `${safeProjectId(project.id)}.json`);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(project, null, 2), "utf8");
    await rename(temporaryPath, path);
  }
}
