import type { ProjectRecord, StructureLoadResult } from "@molecular/contracts";
import { apiClient } from "./apiClient";
import { toProjectPresentation, type RenderProjection } from "../rendering/renderProjection";

export type ProjectPersistenceSnapshot = {
  project: ProjectRecord | null;
  structure: StructureLoadResult | null;
  projection: RenderProjection;
  signal?: AbortSignal;
};

export async function persistProjectSnapshot(snapshot: ProjectPersistenceSnapshot): Promise<ProjectRecord> {
  const target = snapshot.project ?? await apiClient.createProject(undefined, { signal: snapshot.signal });
  return apiClient.saveProject(target.id, {
    name: target.name,
    structure: snapshot.structure,
    presentation: toProjectPresentation(snapshot.projection),
    expectedRevision: snapshot.project ? snapshot.project.revision : target.revision,
  }, { signal: snapshot.signal });
}
