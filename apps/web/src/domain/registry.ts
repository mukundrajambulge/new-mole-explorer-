import type { Capability, CapabilityState } from "@molecular/contracts";

export const ACTION_IDS = {
  WORKSPACE_HOME: "WORKSPACE.HOME",
  WORKSPACE_PROJECTS: "WORKSPACE.PROJECTS",
  WORKSPACE_ANALYSIS: "WORKSPACE.ANALYSIS",
  WORKSPACE_LABORATORY: "WORKSPACE.LABORATORY",
  WORKSPACE_MOLECULAR: "WORKSPACE.MOLECULAR",
  WORKSPACE_CONSOLE: "WORKSPACE.CONSOLE",
  PROJECT_CREATE: "PROJECT.CREATE",
  PROJECT_OPEN: "PROJECT.OPEN",
  PROJECT_SAVE: "PROJECT.SAVE",
  STRUCTURE_IMPORT: "STRUCTURE.IMPORT",
  STRUCTURE_FETCH_RCSB: "STRUCTURE.FETCH_RCSB",
  STRUCTURE_EXPORT: "STRUCTURE.EXPORT",
  FILE_NEW: "FILE.NEW",
  FILE_OPEN: "FILE.OPEN",
  FILE_SAVE: "FILE.SAVE",
  FILE_IMPORT: "FILE.IMPORT",
  FILE_EXPORT: "FILE.EXPORT",
  SELECTION_EVALUATE: "SELECTION.EVALUATE",
  SELECTION_CREATE_NAMED: "SELECTION.CREATE_NAMED",
  CANVAS_SELECT: "CANVAS.SELECT",
  CANVAS_PAN: "CANVAS.PAN",
  CANVAS_ROTATE: "CANVAS.ROTATE",
  CANVAS_ZOOM: "CANVAS.ZOOM",
  CANVAS_FOCUS: "CANVAS.FOCUS",
  REPRESENTATION_SET_STYLE: "REPRESENTATION.SET_STYLE",
  REPRESENTATION_LINES: "REPRESENTATION.LINES",
  REPRESENTATION_STICKS: "REPRESENTATION.STICKS",
  REPRESENTATION_SURFACE: "REPRESENTATION.SURFACE",
  REPRESENTATION_CARTOON: "REPRESENTATION.CARTOON",
  REPRESENTATION_BALL_AND_STICK: "REPRESENTATION.BALL_AND_STICK",
  REPRESENTATION_LICORICE: "REPRESENTATION.LICORICE",
  REPRESENTATION_SPHERES: "REPRESENTATION.SPHERES",
  REPRESENTATION_RIBBON: "REPRESENTATION.RIBBON",
  REPRESENTATION_TOGGLE_PROTEIN: "REPRESENTATION.TOGGLE_PROTEIN",
  REPRESENTATION_TOGGLE_LIGAND: "REPRESENTATION.TOGGLE_LIGAND",
  REPRESENTATION_TOGGLE_WATER: "REPRESENTATION.TOGGLE_WATER",
  REPRESENTATION_TOGGLE_IONS: "REPRESENTATION.TOGGLE_IONS",
  REPRESENTATION_TOGGLE_OTHER: "REPRESENTATION.TOGGLE_OTHER",
  COLOR_APPLY: "COLOR.APPLY",
  MEASURE_DISTANCE: "MEASURE.DISTANCE",
  EDIT_ATOM_DELETE: "EDIT.ATOM_DELETE",
  EDIT_BOND_CREATE: "EDIT.BOND_CREATE",
  EDIT_BOND_DELETE: "EDIT.BOND_DELETE",
  EDIT_BOND_ORDER_SET: "EDIT.BOND_ORDER_SET",
  HISTORY_UNDO: "HISTORY.UNDO",
  HISTORY_REDO: "HISTORY.REDO",
  DOCKING_CONFIGURE: "DOCKING.CONFIGURE",
  DOCKING_RUN: "DOCKING.RUN",
  VIEW_THEME: "VIEW.THEME",
  VIEW_RESET: "VIEW.RESET",
  HELP_OPEN: "HELP.OPEN",
} as const;

export type ActionId = (typeof ACTION_IDS)[keyof typeof ACTION_IDS];

export type ActionDefinition = Capability & {
  id: ActionId;
  group: "WORKSPACE" | "FILE" | "SELECTION" | "CANVAS" | "REPRESENTATION" | "COLOR" | "MEASURE" | "EDIT" | "HISTORY" | "DOCKING" | "VIEW" | "HELP";
};

const supported = (id: ActionId, group: ActionDefinition["group"], label: string, description: string): ActionDefinition => ({
  id,
  group,
  state: "SUPPORTED",
  label,
  description,
});

const comingSoon = (id: ActionId, group: ActionDefinition["group"], label: string, description: string): ActionDefinition => ({
  id,
  group,
  state: "COMING_SOON",
  label,
  description,
});

const unavailable = (id: ActionId, group: ActionDefinition["group"], label: string, description: string): ActionDefinition => ({
  id,
  group,
  state: "UNAVAILABLE",
  label,
  description,
});

export const ACTION_REGISTRY: Record<ActionId, ActionDefinition> = {
  [ACTION_IDS.WORKSPACE_HOME]: supported(ACTION_IDS.WORKSPACE_HOME, "WORKSPACE", "Home workspace", "The G1B workstation home is available."),
  [ACTION_IDS.WORKSPACE_PROJECTS]: comingSoon(ACTION_IDS.WORKSPACE_PROJECTS, "WORKSPACE", "Projects workspace", "Project persistence is reserved for a future gate."),
  [ACTION_IDS.WORKSPACE_ANALYSIS]: comingSoon(ACTION_IDS.WORKSPACE_ANALYSIS, "WORKSPACE", "Analysis workspace", "Structural analysis is reserved for a future gate."),
  [ACTION_IDS.WORKSPACE_LABORATORY]: comingSoon(ACTION_IDS.WORKSPACE_LABORATORY, "WORKSPACE", "Laboratory workspace", "Scientific tools will be added one vertical gate at a time."),
  [ACTION_IDS.WORKSPACE_MOLECULAR]: supported(ACTION_IDS.WORKSPACE_MOLECULAR, "WORKSPACE", "Molecular workspace", "The G1B molecular workstation shell is available."),
  [ACTION_IDS.WORKSPACE_CONSOLE]: supported(ACTION_IDS.WORKSPACE_CONSOLE, "WORKSPACE", "Console workspace", "The G1B command and selection console shell is available."),
  [ACTION_IDS.PROJECT_CREATE]: supported(ACTION_IDS.PROJECT_CREATE, "FILE", "New project", "Create an empty persisted project manifest and clear the workspace."),
  [ACTION_IDS.PROJECT_OPEN]: supported(ACTION_IDS.PROJECT_OPEN, "FILE", "Open project", "Open a saved project by its durable project identity."),
  [ACTION_IDS.PROJECT_SAVE]: supported(ACTION_IDS.PROJECT_SAVE, "FILE", "Save project", "Persist canonical structure, provenance and renderer-neutral presentation state."),
  [ACTION_IDS.STRUCTURE_IMPORT]: supported(ACTION_IDS.STRUCTURE_IMPORT, "FILE", "Import structure", "Load an admitted PDB or mmCIF file through the backend ingestion service."),
  [ACTION_IDS.STRUCTURE_FETCH_RCSB]: supported(ACTION_IDS.STRUCTURE_FETCH_RCSB, "FILE", "Fetch RCSB structure", "Fetch official RCSB mmCIF through the backend service."),
  [ACTION_IDS.STRUCTURE_EXPORT]: comingSoon(ACTION_IDS.STRUCTURE_EXPORT, "FILE", "Export structure", "Export writers and loss manifests are not implemented in G1B."),
  [ACTION_IDS.FILE_NEW]: supported(ACTION_IDS.FILE_NEW, "FILE", "New project", "Create an empty persisted project manifest and clear the workspace."),
  [ACTION_IDS.FILE_OPEN]: supported(ACTION_IDS.FILE_OPEN, "FILE", "Open structure", "Choose a PDB or mmCIF structure file; this converges with Import and Drop."),
  [ACTION_IDS.FILE_SAVE]: supported(ACTION_IDS.FILE_SAVE, "FILE", "Save project", "Persist canonical structure, provenance and renderer-neutral presentation state."),
  [ACTION_IDS.FILE_IMPORT]: supported(ACTION_IDS.FILE_IMPORT, "FILE", "Import structure", "Load an admitted PDB or mmCIF file through the backend ingestion service."),
  [ACTION_IDS.FILE_EXPORT]: comingSoon(ACTION_IDS.FILE_EXPORT, "FILE", "Export", "Export writers and loss manifests are not implemented in G1B."),
  [ACTION_IDS.SELECTION_EVALUATE]: comingSoon(ACTION_IDS.SELECTION_EVALUATE, "SELECTION", "Evaluate selection", "Authoritative selection evaluation is not wired in G1B."),
  [ACTION_IDS.SELECTION_CREATE_NAMED]: comingSoon(ACTION_IDS.SELECTION_CREATE_NAMED, "SELECTION", "Create named selection", "Named selections require the future scientific domain layer."),
  [ACTION_IDS.CANVAS_SELECT]: comingSoon(ACTION_IDS.CANVAS_SELECT, "CANVAS", "Select canvas tool", "Authoritative atom selection is reserved for a future gate."),
  [ACTION_IDS.CANVAS_PAN]: supported(ACTION_IDS.CANVAS_PAN, "CANVAS", "Pan canvas", "Presentation interaction state only."),
  [ACTION_IDS.CANVAS_ROTATE]: supported(ACTION_IDS.CANVAS_ROTATE, "CANVAS", "Rotate canvas", "Presentation interaction state only."),
  [ACTION_IDS.CANVAS_ZOOM]: supported(ACTION_IDS.CANVAS_ZOOM, "CANVAS", "Zoom canvas", "Presentation interaction state only."),
  [ACTION_IDS.CANVAS_FOCUS]: supported(ACTION_IDS.CANVAS_FOCUS, "CANVAS", "Focus canvas", "Presentation interaction state only."),
  [ACTION_IDS.REPRESENTATION_SET_STYLE]: supported(ACTION_IDS.REPRESENTATION_SET_STYLE, "REPRESENTATION", "Set display style", "Presentation-only representation masks are projected from canonical structure identity."),
  [ACTION_IDS.REPRESENTATION_LINES]: supported(ACTION_IDS.REPRESENTATION_LINES, "REPRESENTATION", "Lines", "Render canonical bonds as line segments."),
  [ACTION_IDS.REPRESENTATION_STICKS]: supported(ACTION_IDS.REPRESENTATION_STICKS, "REPRESENTATION", "Sticks", "Render canonical bonds as stick cylinders."),
  [ACTION_IDS.REPRESENTATION_SURFACE]: comingSoon(ACTION_IDS.REPRESENTATION_SURFACE, "REPRESENTATION", "Surface", "Surface calculation is not implemented in G1B."),
  [ACTION_IDS.REPRESENTATION_CARTOON]: supported(ACTION_IDS.REPRESENTATION_CARTOON, "REPRESENTATION", "Cartoon", "Render the backend-loaded structure as cartoon with targeted ligand and ion overlays."),
  [ACTION_IDS.REPRESENTATION_BALL_AND_STICK]: supported(ACTION_IDS.REPRESENTATION_BALL_AND_STICK, "REPRESENTATION", "Ball & stick", "Render the backend-loaded structure as balls and sticks."),
  [ACTION_IDS.REPRESENTATION_LICORICE]: supported(ACTION_IDS.REPRESENTATION_LICORICE, "REPRESENTATION", "Licorice", "Render the backend-loaded structure as sticks."),
  [ACTION_IDS.REPRESENTATION_SPHERES]: supported(ACTION_IDS.REPRESENTATION_SPHERES, "REPRESENTATION", "Spheres", "Render the backend-loaded structure as space-filling spheres."),
  [ACTION_IDS.REPRESENTATION_RIBBON]: comingSoon(ACTION_IDS.REPRESENTATION_RIBBON, "REPRESENTATION", "Ribbon", "Ribbon geometry is not implemented in G1B; Cartoon remains the supported polymer view."),
  [ACTION_IDS.REPRESENTATION_TOGGLE_PROTEIN]: supported(ACTION_IDS.REPRESENTATION_TOGGLE_PROTEIN, "REPRESENTATION", "Toggle protein layer", "Presentation-only visibility toggle for polymer atoms."),
  [ACTION_IDS.REPRESENTATION_TOGGLE_LIGAND]: supported(ACTION_IDS.REPRESENTATION_TOGGLE_LIGAND, "REPRESENTATION", "Toggle ligand layer", "Presentation-only visibility toggle for organic non-polymer atoms."),
  [ACTION_IDS.REPRESENTATION_TOGGLE_WATER]: supported(ACTION_IDS.REPRESENTATION_TOGGLE_WATER, "REPRESENTATION", "Toggle water layer", "Presentation-only visibility toggle for water."),
  [ACTION_IDS.REPRESENTATION_TOGGLE_IONS]: supported(ACTION_IDS.REPRESENTATION_TOGGLE_IONS, "REPRESENTATION", "Toggle ion layer", "Presentation-only visibility toggle for ions."),
  [ACTION_IDS.REPRESENTATION_TOGGLE_OTHER]: supported(ACTION_IDS.REPRESENTATION_TOGGLE_OTHER, "REPRESENTATION", "Toggle other layer", "Presentation-only visibility toggle for other non-polymer atoms."),
  [ACTION_IDS.COLOR_APPLY]: supported(ACTION_IDS.COLOR_APPLY, "COLOR", "Apply display color", "Presentation-only color mode resolved through the pinned ColorRegistry."),
  [ACTION_IDS.MEASURE_DISTANCE]: comingSoon(ACTION_IDS.MEASURE_DISTANCE, "MEASURE", "Measure distance", "Authoritative measurements are not implemented in G1B."),
  [ACTION_IDS.EDIT_ATOM_DELETE]: unavailable(ACTION_IDS.EDIT_ATOM_DELETE, "EDIT", "Delete atom", "Scientific molecular editing is intentionally unavailable in G1B."),
  [ACTION_IDS.EDIT_BOND_CREATE]: unavailable(ACTION_IDS.EDIT_BOND_CREATE, "EDIT", "Create bond", "Scientific molecular editing is intentionally unavailable in G1B."),
  [ACTION_IDS.EDIT_BOND_DELETE]: unavailable(ACTION_IDS.EDIT_BOND_DELETE, "EDIT", "Delete bond", "Scientific molecular editing is intentionally unavailable in G1B."),
  [ACTION_IDS.EDIT_BOND_ORDER_SET]: unavailable(ACTION_IDS.EDIT_BOND_ORDER_SET, "EDIT", "Set bond order", "Scientific molecular editing is intentionally unavailable in G1B."),
  [ACTION_IDS.HISTORY_UNDO]: comingSoon(ACTION_IDS.HISTORY_UNDO, "HISTORY", "Undo", "Scientific revision history will be owned by the backend in a future gate."),
  [ACTION_IDS.HISTORY_REDO]: comingSoon(ACTION_IDS.HISTORY_REDO, "HISTORY", "Redo", "Scientific revision history will be owned by the backend in a future gate."),
  [ACTION_IDS.DOCKING_CONFIGURE]: comingSoon(ACTION_IDS.DOCKING_CONFIGURE, "DOCKING", "Configure docking", "Docking configuration is reserved for a future vertical gate."),
  [ACTION_IDS.DOCKING_RUN]: unavailable(ACTION_IDS.DOCKING_RUN, "DOCKING", "Run docking", "No docking engine or docking scores are available in G1B."),
  [ACTION_IDS.VIEW_THEME]: comingSoon(ACTION_IDS.VIEW_THEME, "VIEW", "Toggle theme", "Theme preferences are reserved for a future gate."),
  [ACTION_IDS.VIEW_RESET]: supported(ACTION_IDS.VIEW_RESET, "VIEW", "Reset view", "Presentation view state only."),
  [ACTION_IDS.HELP_OPEN]: supported(ACTION_IDS.HELP_OPEN, "HELP", "Open help", "Show G1B capability information."),
};

export const getCapability = (actionId: ActionId): Capability => ACTION_REGISTRY[actionId];

export const capabilityTone = (state: CapabilityState): "positive" | "experimental" | "muted" | "danger" => {
  if (state === "SUPPORTED") return "positive";
  if (state === "EXPERIMENTAL") return "experimental";
  if (state === "UNAVAILABLE") return "danger";
  return "muted";
};
