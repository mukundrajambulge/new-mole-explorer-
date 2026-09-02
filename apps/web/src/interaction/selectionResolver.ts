import { REPRESENTATION_MASKS, REPRESENTATION_PRESETS, type RepresentationMask, type RepresentationType } from "../rendering/presentationState";
export { bindSelectionPlan, evaluateSelectionQuery, lexSelection, parseSelection, requireValidSelection, resolveSelection, selectionForStableIds, combineSelections, NamedSelectionStore, SelectionResolutionError } from "../selection/selectionEngine";
export type { BoundSelectionPlan, SelectionResult, SelectionStatus, SelectionAst, SelectionDiagnostic, SelectionToken, SelectionEvaluationOptions, SelectionBindingDependencies, SelectionPresentationContext, SelectionWorkspaceGroup, SelectionCoordinateContext, CoordinateFramePolicy, NamedSelectionSnapshot, SourceSpan } from "../selection/selectionEngine";

export type RepresentationCommand = {
  operation: "SHOW" | "HIDE" | "SHOW_AS";
  mask: RepresentationMask;
  representation: RepresentationType | "BALL_AND_STICK";
  query: string;
};

const representationNames: Record<string, { mask: RepresentationMask; representation: RepresentationType | "BALL_AND_STICK" }> = {
  line: { mask: REPRESENTATION_MASKS.LINES, representation: "LINES" },
  lines: { mask: REPRESENTATION_MASKS.LINES, representation: "LINES" },
  stick: { mask: REPRESENTATION_MASKS.STICKS, representation: "STICKS" },
  sticks: { mask: REPRESENTATION_MASKS.STICKS, representation: "STICKS" },
  sphere: { mask: REPRESENTATION_MASKS.SPHERES, representation: "SPHERES" },
  spheres: { mask: REPRESENTATION_MASKS.SPHERES, representation: "SPHERES" },
  cartoon: { mask: REPRESENTATION_MASKS.CARTOON, representation: "CARTOON" },
  ribbon: { mask: REPRESENTATION_MASKS.RIBBON, representation: "RIBBON" },
  surface: { mask: REPRESENTATION_MASKS.SURFACE, representation: "SURFACE" },
  mesh: { mask: REPRESENTATION_MASKS.MESH, representation: "MESH" },
  dots: { mask: REPRESENTATION_MASKS.DOTS, representation: "DOTS" },
  nonbonded: { mask: REPRESENTATION_MASKS.NONBONDED, representation: "NONBONDED" },
  "non-bonded": { mask: REPRESENTATION_MASKS.NONBONDED, representation: "NONBONDED" },
  "nonbonded-spheres": { mask: REPRESENTATION_MASKS.NB_SPHERES, representation: "NB_SPHERES" },
  "ball-and-stick": { mask: REPRESENTATION_PRESETS.BALL_AND_STICK, representation: "BALL_AND_STICK" },
  "ball&stick": { mask: REPRESENTATION_PRESETS.BALL_AND_STICK, representation: "BALL_AND_STICK" },
};

export const parseRepresentationCommand = (input: string): RepresentationCommand | null => {
  const match = input.trim().match(/^(show_as|show|hide)\s+([^,]+?)(?:\s*,\s*|\s+)(.+)$/i);
  if (!match) return null;
  const definition = representationNames[match[2].trim().toLowerCase()];
  if (!definition) throw new Error(`Unsupported representation in command: ${match[2].trim()}`);
  return { operation: match[1].toUpperCase() as RepresentationCommand["operation"], mask: definition.mask, representation: definition.representation, query: match[3].trim() };
};
