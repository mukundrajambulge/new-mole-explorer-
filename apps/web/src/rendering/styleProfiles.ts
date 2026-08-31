import type { CapabilityState } from "@molecular/contracts";

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
  VDW: {
    profile_id: "surface.vdw.element-vdw.v1",
    surface_kind: "VDW",
    radius_source: "canonical_element_vdw_radius",
    probe_radius: 0,
    coordinate_state: "active",
    target_atoms: "style_target_atoms",
    contributor_atoms: "target_plus_explicit_occluders",
    occluders: "canonical_coordinate_atoms",
    resolution: 0.5,
    quality: "standard",
    generator: "not-implemented-g1c",
    cache_key: "scientificHash:coordinateState:surface.vdw.element-vdw.v1",
    color_source: "atom_color_state",
  },
  SAS: {
    profile_id: "surface.sas.element-vdw.probe-1.4A.v1",
    surface_kind: "SAS",
    radius_source: "canonical_element_vdw_radius",
    probe_radius: 1.4,
    coordinate_state: "active",
    target_atoms: "style_target_atoms",
    contributor_atoms: "target_plus_explicit_occluders",
    occluders: "canonical_coordinate_atoms",
    resolution: 0.5,
    quality: "standard",
    generator: "not-implemented-g1c",
    cache_key: "scientificHash:coordinateState:surface.sas.element-vdw.probe-1.4A.v1",
    color_source: "atom_color_state",
  },
  SES: {
    profile_id: "surface.ses.element-vdw.probe-1.4A.v1",
    surface_kind: "SES",
    radius_source: "canonical_element_vdw_radius",
    probe_radius: 1.4,
    coordinate_state: "active",
    target_atoms: "style_target_atoms",
    contributor_atoms: "target_plus_explicit_occluders",
    occluders: "canonical_coordinate_atoms",
    resolution: 0.5,
    quality: "standard",
    generator: "not-implemented-g1c",
    cache_key: "scientificHash:coordinateState:surface.ses.element-vdw.probe-1.4A.v1",
    color_source: "atom_color_state",
  },
};

export type StyleProfileId =
  | "line"
  | "stick"
  | "ball-and-stick"
  | "space-filling"
  | "van-der-waals-surface"
  | "solvent-accessible-surface"
  | "solvent-excluded-surface"
  | "mesh"
  | "dots"
  | "dot-surface"
  | "cartoon"
  | "ribbon"
  | "trace"
  | "putty"
  | "nonbonded-crosses"
  | "nonbonded-spheres"
  | "licorice";

export type StyleDefinition = {
  id: StyleProfileId;
  label: string;
  actionId: string;
  capability: CapabilityState;
  profile: string;
  preconditions: string;
  rendererProjection: string;
  unsupportedReason?: string;
};

export const STYLE_DEFINITIONS: readonly StyleDefinition[] = [
  { id: "line", label: "Line", actionId: "REPRESENTATION.APPLY_LINE", capability: "SUPPORTED", profile: "canonical-bond-lines.v1", preconditions: "CanonicalBond endpoints and active coordinates", rendererProjection: "3Dmol line style over explicit canonical bond adjacency" },
  { id: "stick", label: "Stick", actionId: "REPRESENTATION.APPLY_STICK", capability: "SUPPORTED", profile: "canonical-bond-sticks.v1", preconditions: "CanonicalBond endpoints and active coordinates", rendererProjection: "3Dmol capped cylinders over explicit canonical bond adjacency" },
  { id: "ball-and-stick", label: "Ball-and-Stick", actionId: "REPRESENTATION.APPLY_BALL_AND_STICK", capability: "SUPPORTED", profile: "canonical-stick-plus-small-sphere.v1", preconditions: "Canonical atom coordinates; canonical bonds for sticks", rendererProjection: "3Dmol canonical sticks plus 0.28 VDW spheres" },
  { id: "space-filling", label: "Space-Filling", actionId: "REPRESENTATION.APPLY_SPACE_FILLING", capability: "SUPPORTED", profile: "canonical-element-vdw-full-radius.v1", preconditions: "Canonical atom coordinates and element identity", rendererProjection: "3Dmol atom-centered full VDW-radius spheres" },
  { id: "van-der-waals-surface", label: "Van der Waals Surface", actionId: "REPRESENTATION.APPLY_VDW_SURFACE", capability: "COMING_SOON", profile: SURFACE_PROFILES.VDW.profile_id, preconditions: "Canonical coordinates and element VDW radii", rendererProjection: "SurfaceProfile reserved; generator not available in G1C", unsupportedReason: "A scientifically governed VDW surface generator is not available in this gate." },
  { id: "solvent-accessible-surface", label: "Solvent-Accessible Surface", actionId: "REPRESENTATION.APPLY_SAS", capability: "COMING_SOON", profile: SURFACE_PROFILES.SAS.profile_id, preconditions: "Canonical coordinates, VDW radii, and 1.4 Å probe", rendererProjection: "Distinct SAS SurfaceProfile; generator not available in G1C", unsupportedReason: "A scientifically governed SAS generator is not available in this gate." },
  { id: "solvent-excluded-surface", label: "Solvent-Excluded Surface", actionId: "REPRESENTATION.APPLY_SES", capability: "COMING_SOON", profile: SURFACE_PROFILES.SES.profile_id, preconditions: "Canonical coordinates, VDW radii, and 1.4 Å probe", rendererProjection: "Distinct SES SurfaceProfile; generator not available in G1C", unsupportedReason: "A scientifically governed SES generator is not available in this gate." },
  { id: "mesh", label: "Mesh", actionId: "REPRESENTATION.APPLY_MESH", capability: "COMING_SOON", profile: "surface-mesh.v1", preconditions: "A governed surface profile", rendererProjection: "No generic surface substitution", unsupportedReason: "Mesh generation is deferred until a governed surface generator exists." },
  { id: "dots", label: "Dots", actionId: "REPRESENTATION.APPLY_DOTS", capability: "COMING_SOON", profile: "surface-dots.v1", preconditions: "A governed surface/dot sampling profile", rendererProjection: "No generic surface substitution", unsupportedReason: "Dot sampling is deferred until a governed surface generator exists." },
  { id: "dot-surface", label: "Dot Surface", actionId: "REPRESENTATION.APPLY_DOT_SURFACE", capability: "COMING_SOON", profile: "surface-dot-surface.v1", preconditions: "A governed surface/dot sampling profile", rendererProjection: "No generic surface substitution", unsupportedReason: "Dot-surface generation is deferred until a governed surface generator exists." },
  { id: "cartoon", label: "Cartoon", actionId: "REPRESENTATION.APPLY_CARTOON", capability: "SUPPORTED_WITH_LIMITATIONS", profile: "canonical-polymer-cartoon.v1", preconditions: "Canonical polymer hierarchy, residue order, chain boundaries, and active coordinates", rendererProjection: "3Dmol cartoon style over canonical polymer atom targets" },
  { id: "ribbon", label: "Ribbon", actionId: "REPRESENTATION.APPLY_RIBBON_STYLE", capability: "SUPPORTED_WITH_LIMITATIONS", profile: "canonical-polymer-ribbon-oval.v1", preconditions: "Canonical polymer hierarchy and active coordinates", rendererProjection: "3Dmol cartoon style=oval; no Cartoon fallback" },
  { id: "trace", label: "Trace", actionId: "REPRESENTATION.APPLY_TRACE", capability: "SUPPORTED_WITH_LIMITATIONS", profile: "canonical-polymer-trace.v1", preconditions: "Canonical polymer hierarchy/backbone and active coordinates", rendererProjection: "3Dmol cartoon style=trace over canonical polymer targets" },
  { id: "putty", label: "Putty", actionId: "REPRESENTATION.APPLY_PUTTY", capability: "SUPPORTED_WITH_LIMITATIONS", profile: "canonical-polymer-putty-bfactor.v1", preconditions: "Canonical polymer hierarchy and source B-factor values", rendererProjection: "3Dmol cartoon style=putty; no fabricated scalar", unsupportedReason: "When B-factor is absent the action reports PUTTY_PROPERTY_UNAVAILABLE." },
  { id: "nonbonded-crosses", label: "Non-bonded (crosses)", actionId: "REPRESENTATION.APPLY_NONBONDED_CROSSES", capability: "SUPPORTED", profile: "canonical-zero-bond-crosses.v1", preconditions: "Canonical topology identifies zero bonded neighbors", rendererProjection: "3Dmol cross style on coordinate-present zero-bond atoms" },
  { id: "nonbonded-spheres", label: "Non-bonded (spheres)", actionId: "REPRESENTATION.APPLY_NONBONDED_SPHERES", capability: "SUPPORTED", profile: "canonical-zero-bond-spheres.v1", preconditions: "Canonical topology identifies zero bonded neighbors", rendererProjection: "3Dmol small spheres on coordinate-present zero-bond atoms" },
  { id: "licorice", label: "Licorice", actionId: "REPRESENTATION.APPLY_LICORICE", capability: "SUPPORTED", profile: "canonical-stick-plus-nb-sphere.v1", preconditions: "Canonical bonds and zero-bond atom topology", rendererProjection: "3Dmol sticks plus nonbonded spheres" },
];

export const styleDefinition = (id: StyleProfileId): StyleDefinition => STYLE_DEFINITIONS.find((definition) => definition.id === id) ?? STYLE_DEFINITIONS[0];
export const styleLabel = (id: StyleProfileId | string): string => STYLE_DEFINITIONS.find((definition) => definition.id === id)?.label ?? "Cartoon";
export const surfaceProfileForStyle = (id: StyleProfileId): SurfaceProfile | null => id === "van-der-waals-surface" ? SURFACE_PROFILES.VDW : id === "solvent-accessible-surface" ? SURFACE_PROFILES.SAS : id === "solvent-excluded-surface" ? SURFACE_PROFILES.SES : null;
