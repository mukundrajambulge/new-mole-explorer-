import type { D2ValidationStatus, StructureLoadResult } from "@molecular/contracts";
import { ApiClientError, apiClient, type D2AdaptationResponse, type D2SearchRegionResponse } from "../lib/apiClient";

export type D2DiagnosticView = Readonly<{
  code: string;
  severity: "ERROR" | "WARNING";
  blocking: boolean;
  message: string;
}>;

export type D2AdaptedSnapshot = Readonly<{
  status: D2ValidationStatus;
  sourceFormat: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  identity?: Readonly<{ identityId: string; graphRevisionDigest: string; digest: string }>;
  graph?: Readonly<{ revisionId: string; atomCount: number; bondCount: number; componentCount: number; componentRoles: readonly string[]; digest: string }>;
  chemicalState?: Readonly<{ stateId: string; resolution: string; protonationStatus: string; tautomerStatus: string; digest: string }>;
  coordinateStates: readonly Readonly<{ stateId: string; coordinateFrame: string; digest: string }>[];
  authoritativeForMolecularIdentity: boolean;
  executionRepresentation?: Readonly<{ format: string; authoritativeForMolecularIdentity: false; artifactByteDigest: string }>;
  diagnostics: readonly string[];
  validationDiagnostics: readonly D2DiagnosticView[];
}>;

export type D2AdaptationResult = Readonly<{ status: D2ValidationStatus; snapshot?: D2AdaptedSnapshot; diagnostics: readonly D2DiagnosticView[] }>;

export type D2SearchRegionAuthority = Readonly<{
  searchRegionId: string;
  digest: string;
  preparedReceptorDigest: string;
  coordinateStateDigest: string;
  coordinateFrame: string;
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  units: "ANGSTROM";
}>;

export type D2SearchRegionResult = Readonly<{ status: D2ValidationStatus; region?: D2SearchRegionAuthority; diagnostics: readonly D2DiagnosticView[] }>;

const diagnosticsFor = (response: D2AdaptationResponse | D2SearchRegionResponse): readonly D2DiagnosticView[] => response.diagnostics.map((diagnostic) => ({ code: diagnostic.code, severity: diagnostic.severity, blocking: diagnostic.blocking, message: diagnostic.message }));

const asTuple = (values: readonly number[] | undefined): readonly [number, number, number] | null => values && values.length === 3 && values.every(Number.isFinite) ? [values[0]!, values[1]!, values[2]!] : null;

const snapshotFor = (response: D2AdaptationResponse): D2AdaptedSnapshot | undefined => {
  const value = response.value;
  if (!value) return undefined;
  return {
    status: response.status,
    sourceFormat: value.sourceFormat,
    sourceArtifactId: value.sourceArtifactId,
    sourceArtifactDigest: value.sourceArtifactDigest,
    ...(value.identity ? { identity: value.identity } : {}),
    ...(value.graph ? { graph: { revisionId: value.graph.revisionId, atomCount: value.graph.atoms.length, bondCount: value.graph.bonds.length, componentCount: value.graph.components.length, componentRoles: value.graph.components.map((component) => component.role), digest: value.graph.digest } } : {}),
    ...(value.chemicalState ? { chemicalState: value.chemicalState } : {}),
    coordinateStates: value.coordinateStates,
    authoritativeForMolecularIdentity: value.authoritativeForMolecularIdentity,
    ...(value.executionRepresentation ? { executionRepresentation: value.executionRepresentation } : {}),
    diagnostics: value.diagnostics,
    validationDiagnostics: diagnosticsFor(response),
  };
};

const regionFor = (response: D2SearchRegionResponse): D2SearchRegionAuthority | undefined => {
  const value = response.value;
  const presentation = response.presentation;
  if (!value || !presentation) return undefined;
  const center = asTuple(presentation.center);
  const size = asTuple(presentation.size);
  const min = asTuple(presentation.min);
  const max = asTuple(presentation.max);
  if (!center || !size || !min || !max) return undefined;
  return { searchRegionId: value.searchRegionId, digest: presentation.digest, preparedReceptorDigest: value.preparedReceptorDigest, coordinateStateDigest: value.coordinateStateDigest, coordinateFrame: presentation.coordinateFrame, center, size, min, max, units: presentation.units };
};

export type DockingApiAdapter = Readonly<{
  adaptStructure: (loadResult: StructureLoadResult) => Promise<D2AdaptationResult>;
  commitSearchRegion: (input: unknown) => Promise<D2SearchRegionResult>;
}>;

export const dockingApiAdapter: DockingApiAdapter = Object.freeze({
  adaptStructure: async (loadResult) => {
    try {
      const response = await apiClient.d2AdaptStructure({ structure: loadResult.structure, ...(loadResult.sourceArtifact ? { sourceArtifact: loadResult.sourceArtifact } : {}) });
      return { status: response.status, ...(snapshotFor(response) ? { snapshot: snapshotFor(response) } : {}), diagnostics: diagnosticsFor(response) };
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : "D2 adaptation request failed.";
      return { status: "INVALID", diagnostics: [{ code: "D2_TRANSPORT_ERROR", severity: "ERROR", blocking: true, message }] };
    }
  },
  commitSearchRegion: async (input) => {
    try {
      const response = await apiClient.d2CommitSearchRegion(input);
      return { status: response.status, ...(regionFor(response) ? { region: regionFor(response) } : {}), diagnostics: diagnosticsFor(response) };
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : "D2 SearchRegion commit failed.";
      return { status: "INVALID", diagnostics: [{ code: "D2_TRANSPORT_ERROR", severity: "ERROR", blocking: true, message }] };
    }
  },
});
