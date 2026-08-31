import type { CanonicalMolecularStructure, CapabilityState } from "@molecular/contracts";

export type SurfaceKind = "VDW" | "SAS" | "SES";
export type SurfaceProfile = {
  profile_id: string;
  surface_kind: SurfaceKind;
  radius_source: "canonical_element_vdw_radius";
  probe_radius: number;
  coordinate_state: "active";
  target_atoms: "style_target_atoms";
  contributor_atoms: "target_plus_explicit_occluders";
  occluders: "canonical_coordinate_atoms";
  resolution: number;
  quality: "preview" | "standard" | "high";
  generator: "not-implemented-g1c";
  cache_key: string;
  color_source: "atom_color_state";
};

export const SURFACE_PROFILES: Record<SurfaceKind, SurfaceProfile> = {
  VDW: { profile_id: "surface.vdw.element-vdw.v1", surface_kind: "VDW", radius_source: "canonical_element_vdw_radius", probe_radius: 0, coordinate_state: "active", target_atoms: "style_target_atoms", contributor_atoms: "target_plus_explicit_occluders", occluders: "canonical_coordinate_atoms", resolution: 0.5, quality: "standard", generator: "not-implemented-g1c", cache_key: "scientificHash:coordinateState:surface.vdw.element-vdw.v1", color_source: "atom_color_state" },
  SAS: { profile_id: "surface.sas.element-vdw.probe-1.4A.v1", surface_kind: "SAS", radius_source: "canonical_element_vdw_radius", probe_radius: 1.4, coordinate_state: "active", target_atoms: "style_target_atoms", contributor_atoms: "target_plus_explicit_occluders", occluders: "canonical_coordinate_atoms", resolution: 0.5, quality: "standard", generator: "not-implemented-g1c", cache_key: "scientificHash:coordinateState:surface.sas.element-vdw.probe-1.4A.v1", color_source: "atom_color_state" },
  SES: { profile_id: "surface.ses.element-vdw.probe-1.4A.v1", surface_kind: "SES", radius_source: "canonical_element_vdw_radius", probe_radius: 1.4, coordinate_state: "active", target_atoms: "style_target_atoms", contributor_atoms: "target_plus_explicit_occluders", occluders: "canonical_coordinate_atoms", resolution: 0.5, quality: "standard", generator: "not-implemented-g1c", cache_key: "scientificHash:coordinateState:surface.ses.element-vdw.probe-1.4A.v1", color_source: "atom_color_state" },
};

export type StyleProfileId =
  | "line" | "stick" | "ball-and-stick" | "space-filling"
  | "van-der-waals-surface" | "solvent-accessible-surface" | "solvent-excluded-surface"
  | "mesh" | "dots" | "dot-surface" | "cartoon" | "ribbon" | "trace" | "putty"
  | "nonbonded-crosses" | "nonbonded-spheres" | "licorice";

export type RepresentationCapabilityStatus =
  | "IMPLEMENTED" | "IMPLEMENTED_WITH_LIMITATIONS" | "INSUFFICIENT_DATA"
  | "VALID_EMPTY" | "NOT_IMPLEMENTED" | "PROFILE_GATED";
export type RepresentationTarget = "protein" | "ligand" | "water" | "ions" | "other";
export type CanonicalRepresentation = "LINES" | "STICKS" | "SPHERES" | "CARTOON" | "RIBBON" | "NONBONDED" | "NB_SPHERES" | "SURFACE" | "MESH" | "DOTS";

/** The single representation capability registry consumed by UI, projection diagnostics, and the adapter boundary. */
export type StyleDefinition = {
  id: StyleProfileId;
  label: string;
  actionId: string;
  capability: CapabilityState;
  status: RepresentationCapabilityStatus;
  profile: string;
  preconditions: string;
  rendererProjection: string;
  canonicalRepresentation: CanonicalRepresentation;
  eligibleTargetTypes: readonly RepresentationTarget[];
  rendererSupport: boolean;
  canonicalSupport: boolean;
  requiredScientificData: readonly string[];
  knownLimitations: readonly string[];
  maySelect: boolean;
  conformanceStatus: "MOLEXPLORER_NATIVE" | "UNVERIFIED_PYMOL_CONFORMANCE";
  unsupportedReason?: string;
};

const ATOM_TARGETS: readonly RepresentationTarget[] = ["protein", "ligand", "water", "ions", "other"];
const POLYMER_TARGETS: readonly RepresentationTarget[] = ["protein"];
const native = "MOLEXPLORER_NATIVE" as const;
const unverified = "UNVERIFIED_PYMOL_CONFORMANCE" as const;

export const STYLE_DEFINITIONS: readonly StyleDefinition[] = [
  { id: "line", label: "Line", actionId: "REPRESENTATION.APPLY_LINE", capability: "SUPPORTED", status: "IMPLEMENTED", profile: "canonical-bond-lines.v1", preconditions: "CanonicalBond endpoints and active coordinates", rendererProjection: "3Dmol line style over canonical bond adjacency", canonicalRepresentation: "LINES", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["CanonicalBond", "coordinates"], knownLimitations: ["Only authoritative bonds are drawn."], maySelect: true, conformanceStatus: native },
  { id: "stick", label: "Stick", actionId: "REPRESENTATION.APPLY_STICK", capability: "SUPPORTED", status: "IMPLEMENTED", profile: "canonical-bond-sticks.v1", preconditions: "CanonicalBond endpoints and active coordinates", rendererProjection: "3Dmol capped cylinders over canonical bond adjacency", canonicalRepresentation: "STICKS", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["CanonicalBond", "coordinates"], knownLimitations: ["Only authoritative bonds are drawn."], maySelect: true, conformanceStatus: native },
  { id: "ball-and-stick", label: "Ball-and-Stick", actionId: "REPRESENTATION.APPLY_BALL_AND_STICK", capability: "SUPPORTED", status: "IMPLEMENTED", profile: "canonical-stick-plus-small-sphere.v1", preconditions: "Canonical coordinates and canonical bonds", rendererProjection: "Canonical sticks plus presentation-scale spheres", canonicalRepresentation: "STICKS", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["coordinates", "CanonicalBond", "element"], knownLimitations: ["Sphere radius is a presentation parameter."], maySelect: true, conformanceStatus: native },
  { id: "space-filling", label: "Space-Filling", actionId: "REPRESENTATION.APPLY_SPACE_FILLING", capability: "SUPPORTED", status: "IMPLEMENTED", profile: "canonical-element-vdw-full-radius.v1", preconditions: "Canonical atom coordinates and element identity", rendererProjection: "Atom-centered full-radius spheres", canonicalRepresentation: "SPHERES", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["coordinates", "element"], knownLimitations: ["This is atom-centered space filling, not a molecular surface."], maySelect: true, conformanceStatus: native },
  { id: "van-der-waals-surface", label: "Van der Waals Surface", actionId: "REPRESENTATION.APPLY_VDW_SURFACE", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: SURFACE_PROFILES.VDW.profile_id, preconditions: "A governed surface generator", rendererProjection: "No surface substitution", canonicalRepresentation: "SURFACE", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["VDW radii", "surface profile"], knownLimitations: ["Native 3Dmol surfaces are not asserted as canonical surface science."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "A governed VDW surface generator is not implemented." },
  { id: "solvent-accessible-surface", label: "Solvent-Accessible Surface", actionId: "REPRESENTATION.APPLY_SAS", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: SURFACE_PROFILES.SAS.profile_id, preconditions: "VDW radii, probe radius, and a governed surface generator", rendererProjection: "No surface substitution", canonicalRepresentation: "SURFACE", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["VDW radii", "probe radius", "surface profile"], knownLimitations: ["No quantitative SASA result is produced."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "A governed solvent-accessible surface generator is not implemented." },
  { id: "solvent-excluded-surface", label: "Solvent-Excluded Surface", actionId: "REPRESENTATION.APPLY_SES", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: SURFACE_PROFILES.SES.profile_id, preconditions: "VDW radii, probe radius, and a governed surface generator", rendererProjection: "No surface substitution", canonicalRepresentation: "SURFACE", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["VDW radii", "probe radius", "surface profile"], knownLimitations: ["No quantitative SES result is produced."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "A governed solvent-excluded surface generator is not implemented." },
  { id: "mesh", label: "Mesh", actionId: "REPRESENTATION.APPLY_MESH", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: "surface-mesh.v1", preconditions: "A governed mesh generator", rendererProjection: "No generic surface/wireframe substitution", canonicalRepresentation: "MESH", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["surface profile", "mesh generator"], knownLimitations: ["Mesh is not a wireframe alias."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "Mesh generation is deferred until a governed surface generator exists." },
  { id: "dots", label: "Dots", actionId: "REPRESENTATION.APPLY_DOTS", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: "surface-dots.v1", preconditions: "A governed dot sampling profile", rendererProjection: "No generic dot substitution", canonicalRepresentation: "DOTS", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["surface profile", "dot sampling profile"], knownLimitations: ["Rendered dots are not a quantitative area result."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "Dot sampling is deferred until a governed surface generator exists." },
  { id: "dot-surface", label: "Dot Surface", actionId: "REPRESENTATION.APPLY_DOT_SURFACE", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: "surface-dot-surface.v1", preconditions: "A governed dot-surface generator", rendererProjection: "No generic surface substitution", canonicalRepresentation: "DOTS", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["surface profile", "dot-surface generator"], knownLimitations: ["Dot-surface generation is not a surface fallback."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "Dot-surface generation is deferred until a governed surface generator exists." },
  { id: "cartoon", label: "Cartoon", actionId: "REPRESENTATION.APPLY_CARTOON", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-polymer-cartoon.v1", preconditions: "Canonical polymer hierarchy and active coordinates", rendererProjection: "3Dmol cartoon over canonical polymer targets", canonicalRepresentation: "CARTOON", eligibleTargetTypes: POLYMER_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["polymer hierarchy", "coordinates"], knownLimitations: ["Exact PyMOL conformance is unverified."], maySelect: true, conformanceStatus: unverified },
  { id: "ribbon", label: "Ribbon", actionId: "REPRESENTATION.APPLY_RIBBON_STYLE", capability: "COMING_SOON", status: "NOT_IMPLEMENTED", profile: "canonical-polymer-ribbon.v1", preconditions: "A governed canonical ribbon path", rendererProjection: "No silent Cartoon substitution", canonicalRepresentation: "RIBBON", eligibleTargetTypes: POLYMER_TARGETS, rendererSupport: true, canonicalSupport: false, requiredScientificData: ["canonical ribbon geometry"], knownLimitations: ["3Dmol cartoon style=oval is renderer capability, not canonical Ribbon support."], maySelect: false, conformanceStatus: unverified, unsupportedReason: "Canonical Ribbon geometry is not implemented; no Cartoon fallback is applied." },
  { id: "trace", label: "Trace", actionId: "REPRESENTATION.APPLY_TRACE", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-polymer-trace.v1", preconditions: "Canonical polymer hierarchy/backbone and active coordinates", rendererProjection: "3Dmol cartoon style=trace", canonicalRepresentation: "CARTOON", eligibleTargetTypes: POLYMER_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["polymer hierarchy", "backbone coordinates"], knownLimitations: ["Exact PyMOL conformance is unverified."], maySelect: true, conformanceStatus: unverified },
  { id: "putty", label: "Putty", actionId: "REPRESENTATION.APPLY_PUTTY", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-polymer-putty-bfactor.v1", preconditions: "Canonical polymer hierarchy and source B-factor values", rendererProjection: "3Dmol cartoon style=putty", canonicalRepresentation: "CARTOON", eligibleTargetTypes: POLYMER_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["polymer hierarchy", "source B-factor values"], knownLimitations: ["No fabricated B-factor is supplied."], maySelect: true, conformanceStatus: unverified, unsupportedReason: "Putty requires source B-factor values." },
  { id: "nonbonded-crosses", label: "Non-bonded (crosses)", actionId: "REPRESENTATION.APPLY_NONBONDED_CROSSES", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-zero-bond-crosses.v1", preconditions: "Canonical topology identifies zero bonded neighbors", rendererProjection: "Crosses on coordinate-present zero-bond atoms", canonicalRepresentation: "NONBONDED", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["canonical topology", "coordinates"], knownLimitations: ["Low or zero eligibility is valid."], maySelect: true, conformanceStatus: native },
  { id: "nonbonded-spheres", label: "Non-bonded (spheres)", actionId: "REPRESENTATION.APPLY_NONBONDED_SPHERES", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-zero-bond-spheres.v1", preconditions: "Canonical topology identifies zero-bond atoms", rendererProjection: "Small spheres on coordinate-present zero-bond atoms", canonicalRepresentation: "NB_SPHERES", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["canonical topology", "coordinates"], knownLimitations: ["Low or zero eligibility is valid."], maySelect: true, conformanceStatus: native },
  { id: "licorice", label: "Licorice", actionId: "REPRESENTATION.APPLY_LICORICE", capability: "SUPPORTED_WITH_LIMITATIONS", status: "IMPLEMENTED_WITH_LIMITATIONS", profile: "canonical-stick-plus-nb-sphere.v1", preconditions: "Canonical bonds and zero-bond atom topology", rendererProjection: "3Dmol sticks plus non-bonded spheres", canonicalRepresentation: "STICKS", eligibleTargetTypes: ATOM_TARGETS, rendererSupport: true, canonicalSupport: true, requiredScientificData: ["canonical topology", "coordinates"], knownLimitations: ["Non-bonded contribution may be sparse by definition."], maySelect: true, conformanceStatus: native },
];

const normalizeStyleId = (id: string): StyleProfileId => id === "lines" ? "line" : id === "sticks" ? "stick" : id as StyleProfileId;
export const styleDefinition = (id: string): StyleDefinition => STYLE_DEFINITIONS.find((definition) => definition.id === normalizeStyleId(id)) ?? STYLE_DEFINITIONS[0];
export const styleLabel = (id: StyleProfileId | string): string => styleDefinition(id).label;
export const surfaceProfileForStyle = (id: StyleProfileId | string): SurfaceProfile | null => normalizeStyleId(id) === "van-der-waals-surface" ? SURFACE_PROFILES.VDW : normalizeStyleId(id) === "solvent-accessible-surface" ? SURFACE_PROFILES.SAS : normalizeStyleId(id) === "solvent-excluded-surface" ? SURFACE_PROFILES.SES : null;

export type ResolvedRepresentationCapability = StyleDefinition & { eligibleAtomCount: number | null; diagnostic?: string };

export const representationCapabilityFor = (style: string, structure: CanonicalMolecularStructure | null = null): ResolvedRepresentationCapability => {
  const definition = styleDefinition(style);
  if (definition.id === "putty" && structure && !structure.atoms.some((atom) => atom.isPolymer && atom.bFactor !== undefined && atom.bFactor !== null)) {
    return { ...definition, status: "INSUFFICIENT_DATA", capability: "UNAVAILABLE", maySelect: false, eligibleAtomCount: structure.atoms.filter((atom) => atom.isPolymer).length, diagnostic: "Putty unavailable: canonical source B-factor values are required." };
  }
  if (definition.id === "nonbonded-crosses" || definition.id === "nonbonded-spheres") {
    const bondedIds = new Set(structure?.bonds.flatMap((bond) => [bond.atom1, bond.atom2]) ?? []);
    const eligibleAtomCount = structure ? structure.atoms.filter((atom) => !bondedIds.has(atom.stableId)).length : null;
    if (eligibleAtomCount === 0) return { ...definition, status: "VALID_EMPTY", eligibleAtomCount, diagnostic: "Valid empty result: 0 eligible non-bonded atoms in this structure." };
    return { ...definition, eligibleAtomCount };
  }
  return { ...definition, eligibleAtomCount: structure ? structure.atoms.length : null };
};

export const representationCapabilitiesForTarget = (target: RepresentationTarget, structure: CanonicalMolecularStructure | null = null): ResolvedRepresentationCapability[] => STYLE_DEFINITIONS.filter((definition) => definition.eligibleTargetTypes.includes(target)).map((definition) => representationCapabilityFor(definition.id, structure));

export const representationStyleForCommand = (representation: string): StyleProfileId | null => ({
  LINES: "line", STICKS: "stick", SPHERES: "space-filling", CARTOON: "cartoon", RIBBON: "ribbon",
  NONBONDED: "nonbonded-crosses", NB_SPHERES: "nonbonded-spheres", BALL_AND_STICK: "ball-and-stick",
  SURFACE: "van-der-waals-surface", MESH: "mesh", DOTS: "dots",
}[representation] as StyleProfileId | undefined) ?? null;
