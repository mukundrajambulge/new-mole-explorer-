import {
  D2_KINEMATIC_PROFILE_ID,
  D2_LIGAND_PROFILE_ID,
  D2_RECEPTOR_PROFILE_ID,
  D2_SCHEMA_VERSION,
  D2_SEARCH_REGION_PROFILE_ID,
  D2_SUPPORTED_CORE_ELEMENTS,
  f64Bits,
  f64Value,
  type D2AtomUID,
  type D2ChemicalStateV1,
  type D2CoordinateStateV1,
  type D2Diagnostic,
  type D2GraphBondV1,
  type D2GraphComponentV1,
  type D2KinematicFragmentV1,
  type D2LigandKinematicModelV1,
  type D2MolecularGraphRevisionV1,
  type D2MolecularIdentityV1,
  type D2PreparedLigandStateV1,
  type D2PreparedReceptorStateV1,
  type D2ProvenanceRecordV1,
  type D2ReceptorAssemblySelection,
  type D2ReceptorComponentRoleV1,
  type D2RotatableEdgeV1,
  type D2SealResult,
  type D2SearchRegionV1,
  type D2ValidationStatus,
  type MolecularIdentityDigest,
} from "@molecular/contracts";
import { scientificDigest } from "./scientificSerialization.js";
import { d2Error, d2Warning, deepFreeze, sealResult, unique } from "./d2Validation.js";

const MAX_LIGAND_ATOMS = 256;
const MAX_LIGAND_HEAVY_ATOMS = 128;
const MAX_LIGAND_BONDS = 384;
const MAX_SEARCH_TORSIONS = 32;
const MAX_RECEPTOR_ATOMS = 250_000;
const MAX_RECEPTOR_RESIDUES = 50_000;
const MAX_SEARCH_REGION_SIDE_ANGSTROM = 40;
const MAX_SEARCH_REGION_VOLUME_ANGSTROM3 = 64_000;

const allGraphAtomUids = (graph: D2MolecularGraphRevisionV1): Set<D2AtomUID> => new Set(graph.atoms.map((atom) => atom.atomUid));
const bondMapFor = (graph: D2MolecularGraphRevisionV1): Map<string, D2GraphBondV1> => new Map(graph.bonds.map((bond) => [bond.bondUid, bond]));
const componentMapFor = (graph: D2MolecularGraphRevisionV1): Map<string, D2GraphComponentV1> => new Map(graph.components.map((component) => [component.componentId, component]));

const isSha256 = (value: string): boolean => /^sha256:[0-9a-f]{64}$/.test(value);
const isFiniteBits = (value: unknown): value is ReturnType<typeof f64Bits> => {
  if (!value || typeof value !== "object") return false;
  try { return Number.isFinite(f64Value(value as ReturnType<typeof f64Bits>)); } catch { return false; }
};

const validateCoordinateState = (state: D2CoordinateStateV1, graph: D2MolecularGraphRevisionV1, diagnostics: D2Diagnostic[]): void => {
  if (state.coordinateUnits !== "ANGSTROM") diagnostics.push(d2Error("INVALID_COORDINATE_UNITS", "D2 scientific coordinates must be in Ångström.", "coordinateUnits"));
  if (state.dimensionality !== 3) diagnostics.push(d2Error("INVALID_COORDINATE_DIMENSIONALITY", "D2 scientific coordinates must be three-dimensional.", "dimensionality"));
  if (!state.coordinateFrame.trim()) diagnostics.push(d2Error("INVALID_COORDINATE_FRAME", "Coordinate frame must be explicit and non-empty.", "coordinateFrame"));
  const graphAtoms = allGraphAtomUids(graph);
  const coordinateKeys = Object.keys(state.coordinates);
  for (const atomUid of graphAtoms) {
    const coordinate = state.coordinates[atomUid];
    if (!coordinate) diagnostics.push(d2Error("INVALID_MISSING_COORDINATE", `CoordinateState is missing coordinates for AtomUID ${atomUid}.`, `coordinates.${atomUid}`));
    else if (coordinate.length !== 3 || coordinate.some((value) => !isFiniteBits(value))) diagnostics.push(d2Error("INVALID_NONFINITE_COORDINATE", `CoordinateState for AtomUID ${atomUid} is not a finite three-vector.`, `coordinates.${atomUid}`));
  }
  for (const atomUid of coordinateKeys) if (!graphAtoms.has(atomUid as D2AtomUID)) diagnostics.push(d2Error("INVALID_ORPHAN_COORDINATE", `CoordinateState contains an AtomUID absent from the graph: ${atomUid}.`, `coordinates.${atomUid}`));
};

const validateIdentityLinks = (identity: D2MolecularIdentityV1, graph: D2MolecularGraphRevisionV1, chemical: D2ChemicalStateV1, coordinate: D2CoordinateStateV1, diagnostics: D2Diagnostic[]): void => {
  if (identity.graphRevisionDigest !== graph.digest) diagnostics.push(d2Error("INVALID_IDENTITY_GRAPH_LINK", "MolecularIdentity does not bind the supplied graph revision."));
  if (chemical.molecularIdentityDigest !== identity.digest) diagnostics.push(d2Error("INVALID_CHEMICAL_IDENTITY_LINK", "ChemicalState does not bind the supplied MolecularIdentity."));
  if (coordinate.chemicalStateDigest !== chemical.digest) diagnostics.push(d2Error("INVALID_COORDINATE_CHEMICAL_LINK", "CoordinateState does not bind the supplied ChemicalState."));
  if (!isSha256(identity.digest) || !isSha256(graph.digest) || !isSha256(chemical.digest) || !isSha256(coordinate.digest)) diagnostics.push(d2Error("INVALID_DIGEST", "All scientific state links must use canonical SHA-256 digests."));
};

const validateExplicitChemicalState = (state: D2ChemicalStateV1, selectedAtomUids: ReadonlySet<D2AtomUID>, diagnostics: D2Diagnostic[]): void => {
  if (state.resolution === "GENERATED_PROFILE") diagnostics.push(d2Error("UNSUPPORTED_AUTOMATIC_CHEMICAL_STATE", "The D2 core profile cannot automatically generate protonation or tautomer states."));
  if (state.resolution === "AMBIGUOUS" || state.resolution === "UNKNOWN") diagnostics.push(d2Error("AMBIGUOUS_CHEMICAL_STATE", "An explicit resolved ChemicalState is required before ordinary-V1 sealing."));
  if (state.resolution === "GENERATED_PROFILE" && (!state.targetPH || !state.protonationProfileId)) diagnostics.push(d2Error("INVALID_GENERATED_STATE_PROFILE", "Generated protonation requires explicit target_pH and a named profile."));
  for (const stereo of state.stereo) {
    if (!selectedAtomUids.has(stereo.atomUid)) continue;
    if (stereo.status === "UNSPECIFIED" || stereo.status === "UNKNOWN" || stereo.status === "CONTRADICTORY") diagnostics.push(d2Error("AMBIGUOUS_STEREOCHEMISTRY", `Stereo status ${stereo.status} for AtomUID ${stereo.atomUid} is unresolved.`, `stereo.${stereo.atomUid}`));
  }
};

const provenanceFor = (operation: string, profileId: string, inputDigests: readonly string[], informationLoss: D2ProvenanceRecordV1["informationLoss"], mappingRefs: readonly string[] = [], sourceArtifactRefs: readonly string[] = []): D2ProvenanceRecordV1 => {
  const payload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_PROVENANCE_RECORD_V1", operation, softwareRef: "molecular-workstation-d2", profileId, inputDigests, sourceArtifactRefs, mappingRefs, informationLoss } as const;
  const digest = scientificDigest<"ProvenanceRecordDigest">("D2_PROVENANCE_RECORD", "D2_PROVENANCE_RECORD_V1", payload);
  return deepFreeze({ ...payload, recordId: `provenance:${digest.slice(-16)}`, digest });
};

export type D2PreparedReceptorInput = Readonly<{
  receptorIdentity: D2MolecularIdentityV1;
  graphRevision: D2MolecularGraphRevisionV1;
  chemicalState: D2ChemicalStateV1;
  coordinateState: D2CoordinateStateV1;
  assembly: D2ReceptorAssemblySelection;
  modelNumber: number;
  chainIds: readonly string[];
  altlocResolution: D2PreparedReceptorStateV1["altlocResolution"];
  componentRoles: readonly D2ReceptorComponentRoleV1[];
  profileId: typeof D2_RECEPTOR_PROFILE_ID;
  siteCriticalAtomUids: readonly D2AtomUID[];
}>;

export const sealPreparedReceptorState = (input: D2PreparedReceptorInput): D2SealResult<D2PreparedReceptorStateV1> => {
  const diagnostics: D2Diagnostic[] = [];
  if (input.profileId !== D2_RECEPTOR_PROFILE_ID) diagnostics.push(d2Error("UNSUPPORTED_RECEPTOR_PROFILE", `Only ${D2_RECEPTOR_PROFILE_ID} is admitted by D2.`));
  const atomUids = allGraphAtomUids(input.graphRevision);
  validateIdentityLinks(input.receptorIdentity, input.graphRevision, input.chemicalState, input.coordinateState, diagnostics);
  validateCoordinateState(input.coordinateState, input.graphRevision, diagnostics);
  validateExplicitChemicalState(input.chemicalState, atomUids, diagnostics);
  if (!input.assembly.assemblyId.trim()) diagnostics.push(d2Error("INVALID_ASSEMBLY_SELECTION", "Receptor assembly selection must be explicit and non-empty.", "assembly.assemblyId"));
  if (!isSha256(input.assembly.membershipDigest)) diagnostics.push(d2Error("INVALID_ASSEMBLY_MEMBERSHIP_DIGEST", "Assembly membership must carry a canonical digest."));
  if (!Number.isSafeInteger(input.modelNumber) || input.modelNumber < 1) diagnostics.push(d2Error("INVALID_MODEL_SELECTION", "Receptor model selection must be an explicit positive integer.", "modelNumber"));
  if (!input.chainIds.length || input.chainIds.some((chainId) => !chainId.trim()) || unique(input.chainIds).length !== input.chainIds.length) diagnostics.push(d2Error("INVALID_CHAIN_SELECTION", "Receptor chain/operator membership must be explicit, non-empty, and duplicate-free.", "chainIds"));
  if (input.altlocResolution.status === "AMBIGUOUS") diagnostics.push(d2Error("AMBIGUOUS_ALTLOC_SELECTION", "Ambiguous alternate-location selection blocks receptor sealing.", "altlocResolution"));
  if (input.altlocResolution.policy === "COHERENT_MAX_OCCUPANCY_V1" && input.altlocResolution.status !== "UNIQUE") diagnostics.push(d2Error("AMBIGUOUS_ALTLOC_SELECTION", "Coherent maximum-occupancy selection is admissible only when unique.", "altlocResolution"));
  if (input.siteCriticalAtomUids.some((atomUid) => !atomUids.has(atomUid))) diagnostics.push(d2Error("INVALID_SITE_CRITICAL_ATOM", "Every site-critical AtomUID must exist in the selected receptor graph.", "siteCriticalAtomUids"));
  const componentIds = new Set(input.graphRevision.components.map((component) => component.componentId));
  const roleIds = input.componentRoles.map((role) => role.componentId);
  if (unique(roleIds).length !== roleIds.length || roleIds.some((componentId) => !componentIds.has(componentId))) diagnostics.push(d2Error("INVALID_COMPONENT_ROLE_MAPPING", "Receptor component roles must map one-to-one to graph components."));
  if (input.componentRoles.some((role) => role.role === "MOBILE_WATER" || role.role === "FIXED_WATER")) diagnostics.push(d2Error("UNSUPPORTED_WATER_POLICY", "CORE_DRY_V1 does not silently retain mobile or fixed water; select an explicit future water profile."));
  if (input.graphRevision.atoms.length > MAX_RECEPTOR_ATOMS) diagnostics.push(d2Error("RESOURCE_RECEPTOR_ATOM_LIMIT", `Prepared receptor exceeds ${MAX_RECEPTOR_ATOMS} atoms.`));
  if (input.graphRevision.components.length > MAX_RECEPTOR_RESIDUES) diagnostics.push(d2Error("RESOURCE_RECEPTOR_RESIDUE_LIMIT", `Prepared receptor exceeds ${MAX_RECEPTOR_RESIDUES} component/residue entries.`));
  const payload = {
    schemaVersion: D2_SCHEMA_VERSION,
    semanticSchemaId: "D2_PREPARED_RECEPTOR_STATE_V1",
    receptorIdentityDigest: input.receptorIdentity.digest,
    graphRevisionDigest: input.graphRevision.digest,
    chemicalStateDigest: input.chemicalState.digest,
    coordinateStateDigest: input.coordinateState.digest,
    assembly: input.assembly,
    modelNumber: input.modelNumber,
    chainIds: input.chainIds,
    altlocResolution: input.altlocResolution,
    componentRoles: input.componentRoles,
    profileId: input.profileId,
    siteCriticalAtomUids: input.siteCriticalAtomUids,
  } as const;
  const validationDigest = scientificDigest<"ProvenanceRecordDigest">("D2_RECEPTOR_VALIDATION", "D2_RECEPTOR_VALIDATION_V1", { profileId: input.profileId, atomCount: input.graphRevision.atoms.length, componentRoles: input.componentRoles, siteCriticalAtomUids: input.siteCriticalAtomUids });
  const provenance = provenanceFor("SEAL_PREPARED_RECEPTOR_STATE", input.profileId, [input.receptorIdentity.digest, input.graphRevision.digest, input.chemicalState.digest, input.coordinateState.digest], [
    { field: "assembly", status: "PRESERVED", explanation: "Assembly/model/chain/altloc choices are hash-active and explicit." },
    { field: "water", status: "PRESERVED", explanation: "CORE_DRY_V1 excludes water by explicit component-role validation." },
  ], [input.graphRevision.digest], input.graphRevision.sourceArtifactIds);
  const digest = scientificDigest<"PreparedReceptorDigest">("D2_PREPARED_RECEPTOR_STATE", "D2_PREPARED_RECEPTOR_STATE_V1", payload);
  const value: D2PreparedReceptorStateV1 = deepFreeze({ ...payload, preparedStateId: `prepared-receptor:${digest.slice(-16)}`, receptorIdentity: input.receptorIdentity, graphRevision: input.graphRevision, chemicalState: input.chemicalState, coordinateState: input.coordinateState, validationDigest, provenance, digest });
  return sealResult(value, diagnostics, provenance);
};

export type D2KinematicModelInput = Readonly<{
  molecularIdentityDigest: MolecularIdentityDigest;
  graphRevision: D2MolecularGraphRevisionV1;
  rootAtomUid: D2AtomUID;
  fragments: readonly D2KinematicFragmentV1[];
  rotatableEdges: readonly D2RotatableEdgeV1[];
  profileId: typeof D2_KINEMATIC_PROFILE_ID;
}>;

export const sealLigandKinematicModel = (input: D2KinematicModelInput): D2SealResult<D2LigandKinematicModelV1> => {
  const diagnostics: D2Diagnostic[] = [];
  if (input.profileId !== D2_KINEMATIC_PROFILE_ID) diagnostics.push(d2Error("UNSUPPORTED_KINEMATIC_PROFILE", `Only ${D2_KINEMATIC_PROFILE_ID} is admitted by D2.`));
  const atoms = allGraphAtomUids(input.graphRevision);
  const bonds = bondMapFor(input.graphRevision);
  if (!atoms.has(input.rootAtomUid)) diagnostics.push(d2Error("INVALID_KINEMATIC_ROOT", "Kinematic root AtomUID is absent from the ligand graph.", "rootAtomUid"));
  const fragmentIds = new Set(input.fragments.map((fragment) => fragment.fragmentId));
  const fragmentAtoms = new Set<D2AtomUID>();
  for (const fragment of input.fragments) {
    if (!fragment.fragmentId.trim() || !fragment.atomUids.length) diagnostics.push(d2Error("INVALID_KINEMATIC_FRAGMENT", "Every kinematic fragment requires a non-empty ID and at least one AtomUID."));
    for (const atomUid of fragment.atomUids) {
      if (!atoms.has(atomUid)) diagnostics.push(d2Error("INVALID_KINEMATIC_FRAGMENT_ATOM", `Kinematic fragment references absent AtomUID ${atomUid}.`));
      if (fragmentAtoms.has(atomUid)) diagnostics.push(d2Error("INVALID_KINEMATIC_FRAGMENT_PARTITION", `AtomUID ${atomUid} occurs in more than one rigid fragment.`));
      fragmentAtoms.add(atomUid);
    }
  }
  if (fragmentAtoms.size !== atoms.size) diagnostics.push(d2Error("INVALID_KINEMATIC_FRAGMENT_PARTITION", "Kinematic fragments must cover every ligand AtomUID exactly once."));
  const edgeIds = new Set<string>();
  for (const edge of input.rotatableEdges) {
    const bond = bonds.get(edge.bondUid);
    if (!bond || !((bond.atom1Uid === edge.atom1Uid && bond.atom2Uid === edge.atom2Uid) || (bond.atom1Uid === edge.atom2Uid && bond.atom2Uid === edge.atom1Uid))) diagnostics.push(d2Error("INVALID_KINEMATIC_BOND", `Rotatable edge ${edge.bondUid} does not map to the exact graph bond.`));
    if (bond && bond.order !== "SINGLE") diagnostics.push(d2Error("UNSUPPORTED_KINEMATIC_BOND_ORDER", `Rotatable edge ${edge.bondUid} is not an explicit acyclic single bond.`));
    if (edgeIds.has(edge.bondUid)) diagnostics.push(d2Error("INVALID_DUPLICATE_KINEMATIC_EDGE", `Rotatable edge ${edge.bondUid} occurs more than once.`));
    edgeIds.add(edge.bondUid);
    if (edge.ringBond) diagnostics.push(d2Error("UNSUPPORTED_RING_BOND_ROTATION", `Ring bond ${edge.bondUid} cannot be a rotatable edge.`));
    if (edge.restrictedBond) diagnostics.push(d2Error("UNSUPPORTED_RESTRICTED_BOND_ROTATION", `Restricted amide-like bond ${edge.bondUid} cannot be a rotatable edge.`));
    if (edge.terminalHydrogenOnly) diagnostics.push(d2Error("INVALID_TERMINAL_HYDROGEN_TORSION", `Terminal hydrogen-only edge ${edge.bondUid} cannot be a search torsion.`));
    if (!fragmentIds.has(edge.parentFragmentId) || !fragmentIds.has(edge.childFragmentId) || edge.parentFragmentId === edge.childFragmentId) diagnostics.push(d2Error("INVALID_KINEMATIC_FRAGMENT_EDGE", `Rotatable edge ${edge.bondUid} must connect two distinct declared fragments.`));
    if (!edge.movingAtomUids.length || edge.movingAtomUids.some((atomUid) => !atoms.has(atomUid))) diagnostics.push(d2Error("INVALID_KINEMATIC_MOVING_SET", `Rotatable edge ${edge.bondUid} has an invalid moving atom set.`));
    if (edge.axisDirection.some((value) => !isFiniteBits(value)) || edge.axisOrigin.some((value) => !isFiniteBits(value))) diagnostics.push(d2Error("INVALID_KINEMATIC_AXIS", `Rotatable edge ${edge.bondUid} has a nonfinite axis."`));
    if (edge.periodicity < 1 || !Number.isSafeInteger(edge.periodicity)) diagnostics.push(d2Error("INVALID_KINEMATIC_PERIODICITY", `Rotatable edge ${edge.bondUid} must have a positive integer periodicity.`));
  }
  const searchTorsionCount = input.rotatableEdges.filter((edge) => edge.searchTorsion).length;
  const scorerTorsionCount = input.rotatableEdges.filter((edge) => edge.scorerTorsion).length;
  if (searchTorsionCount > MAX_SEARCH_TORSIONS) diagnostics.push(d2Error("RESOURCE_SEARCH_TORSION_LIMIT", `Kinematic model exceeds the ${MAX_SEARCH_TORSIONS}-torsion ordinary-V1 limit.`));
  const payload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_LIGAND_KINEMATIC_MODEL_V1", molecularIdentityDigest: input.molecularIdentityDigest, rootAtomUid: input.rootAtomUid, fragments: input.fragments, rotatableEdges: input.rotatableEdges, searchTorsionCount, scorerTorsionCount, profileId: input.profileId } as const;
  const provenance = provenanceFor("SEAL_LIGAND_KINEMATIC_MODEL", input.profileId, [input.graphRevision.digest, input.molecularIdentityDigest], [{ field: "search_torsion_count", status: "DERIVED", explanation: "Counted only explicit admissible rotatable edges." }, { field: "scorer_torsion_count", status: "DERIVED", explanation: "Scorer torsion accounting remains distinct from search torsions." }], [input.graphRevision.digest], input.graphRevision.sourceArtifactIds);
  const digest = scientificDigest<"LigandKinematicModelDigest">("D2_LIGAND_KINEMATIC_MODEL", "D2_LIGAND_KINEMATIC_MODEL_V1", payload);
  const value: D2LigandKinematicModelV1 = deepFreeze({ ...payload, modelId: `kinematic:${digest.slice(-16)}`, provenance, digest });
  return sealResult(value, diagnostics, provenance);
};

export type D2PreparedLigandInput = Readonly<{
  molecularIdentity: D2MolecularIdentityV1;
  graphRevision: D2MolecularGraphRevisionV1;
  chemicalState: D2ChemicalStateV1;
  coordinateState: D2CoordinateStateV1;
  selectedComponentId: D2GraphComponentV1["componentId"];
  atomTyping: readonly D2PreparedLigandStateV1["atomTyping"][number][];
  kinematicModel: D2LigandKinematicModelV1;
  profileId: typeof D2_LIGAND_PROFILE_ID;
}>;

export const sealPreparedLigandState = (input: D2PreparedLigandInput): D2SealResult<D2PreparedLigandStateV1> => {
  const diagnostics: D2Diagnostic[] = [];
  if (input.profileId !== D2_LIGAND_PROFILE_ID) diagnostics.push(d2Error("UNSUPPORTED_LIGAND_PROFILE", `Only ${D2_LIGAND_PROFILE_ID} is admitted by D2.`));
  const component = componentMapFor(input.graphRevision).get(input.selectedComponentId);
  if (!component) diagnostics.push(d2Error("AMBIGUOUS_COMPONENT_SELECTION", "Ligand preparation requires exactly one explicit selected component."));
  else if (component.role !== "LIGAND") diagnostics.push(d2Error("UNSUPPORTED_COMPONENT_ROLE", `Component ${input.selectedComponentId} is not an ordinary-V1 ligand component.`));
  const selectedAtoms = new Set(component?.atomUids ?? []);
  if (input.chemicalState.selectedComponentIds.length !== 1 || input.chemicalState.selectedComponentIds[0] !== input.selectedComponentId) diagnostics.push(d2Error("AMBIGUOUS_COMPONENT_SELECTION", "ChemicalState and PreparedLigandState must select exactly the same one docked component."));
  validateIdentityLinks(input.molecularIdentity, input.graphRevision, input.chemicalState, input.coordinateState, diagnostics);
  validateCoordinateState(input.coordinateState, input.graphRevision, diagnostics);
  validateExplicitChemicalState(input.chemicalState, selectedAtoms, diagnostics);
  const selectedGraphAtoms = input.graphRevision.atoms.filter((atom) => selectedAtoms.has(atom.atomUid));
  const selectedBonds = input.graphRevision.bonds.filter((bond) => selectedAtoms.has(bond.atom1Uid) && selectedAtoms.has(bond.atom2Uid));
  if (selectedGraphAtoms.length > 1 && selectedBonds.length === 0) diagnostics.push(d2Error("UNSUPPORTED_MISSING_LIGAND_BOND_GRAPH", "PDB-coordinate-only or otherwise bondless ligand input cannot establish canonical chemical identity."));
  if (selectedBonds.some((bond) => bond.order === "UNKNOWN" || bond.evidence === "UNKNOWN")) diagnostics.push(d2Error("AMBIGUOUS_LIGAND_BOND_GRAPH", "Unknown ligand bond order/evidence blocks ordinary-V1 sealing; no single-bond fallback is permitted."));
  if (selectedGraphAtoms.length > MAX_LIGAND_ATOMS) diagnostics.push(d2Error("RESOURCE_LIGAND_ATOM_LIMIT", `Prepared ligand exceeds ${MAX_LIGAND_ATOMS} total atoms.`));
  if (selectedGraphAtoms.filter((atom) => atom.element.toUpperCase() !== "H").length > MAX_LIGAND_HEAVY_ATOMS) diagnostics.push(d2Error("RESOURCE_LIGAND_HEAVY_ATOM_LIMIT", `Prepared ligand exceeds ${MAX_LIGAND_HEAVY_ATOMS} heavy atoms.`));
  if (selectedBonds.length > MAX_LIGAND_BONDS) diagnostics.push(d2Error("RESOURCE_LIGAND_BOND_LIMIT", `Prepared ligand exceeds ${MAX_LIGAND_BONDS} bonds.`));
  const supported = new Set<string>(D2_SUPPORTED_CORE_ELEMENTS);
  if (selectedGraphAtoms.some((atom) => !supported.has(atom.element.toUpperCase()))) diagnostics.push(d2Error("UNSUPPORTED_LIGAND_ELEMENT", "Unsupported ligand elements require an explicitly qualified chemistry profile; no generic fallback is permitted."));
  const typingByAtom = new Map(input.atomTyping.map((assignment) => [assignment.atomUid, assignment]));
  if (typingByAtom.size !== input.atomTyping.length || input.atomTyping.some((assignment) => !selectedAtoms.has(assignment.atomUid) || !assignment.typeId.trim() || !assignment.chargeModel.trim() || !assignment.evidenceRef.trim())) diagnostics.push(d2Error("INVALID_ATOM_TYPING_ASSIGNMENT", "Atom typing must be explicit, complete, duplicate-free, and evidence-bearing."));
  if (typingByAtom.size !== selectedAtoms.size) diagnostics.push(d2Error("INVALID_ATOM_TYPING_ASSIGNMENT", "Every selected ligand AtomUID requires exactly one explicit typing assignment."));
  if (input.kinematicModel.molecularIdentityDigest !== input.molecularIdentity.digest) diagnostics.push(d2Error("INVALID_KINEMATIC_IDENTITY_LINK", "LigandKinematicModel must bind the same MolecularIdentity as PreparedLigandState."));
  if (input.kinematicModel.searchTorsionCount > MAX_SEARCH_TORSIONS) diagnostics.push(d2Error("RESOURCE_SEARCH_TORSION_LIMIT", `Prepared ligand exceeds the ${MAX_SEARCH_TORSIONS}-torsion ordinary-V1 limit.`));
  const payload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_PREPARED_LIGAND_STATE_V1", molecularIdentityDigest: input.molecularIdentity.digest, graphRevisionDigest: input.graphRevision.digest, chemicalStateDigest: input.chemicalState.digest, coordinateStateDigest: input.coordinateState.digest, selectedComponentId: input.selectedComponentId, atomTyping: input.atomTyping, kinematicModelDigest: input.kinematicModel.digest, profileId: input.profileId } as const;
  const provenance = provenanceFor("SEAL_PREPARED_LIGAND_STATE", input.profileId, [input.molecularIdentity.digest, input.graphRevision.digest, input.chemicalState.digest, input.coordinateState.digest, input.kinematicModel.digest], [{ field: "chemical_state_generation", status: "PRESERVED", explanation: "Only the explicit supplied ChemicalState is admitted." }, { field: "coordinate_state_generation", status: "PRESERVED", explanation: "Only the explicit supplied finite 3D CoordinateState is admitted." }], [input.graphRevision.digest], input.graphRevision.sourceArtifactIds);
  const digest = scientificDigest<"PreparedLigandDigest">("D2_PREPARED_LIGAND_STATE", "D2_PREPARED_LIGAND_STATE_V1", payload);
  const value: D2PreparedLigandStateV1 = deepFreeze({ ...payload, preparedStateId: `prepared-ligand:${digest.slice(-16)}`, molecularIdentity: input.molecularIdentity, graphRevision: input.graphRevision, chemicalState: input.chemicalState, coordinateState: input.coordinateState, selectedComponentId: input.selectedComponentId, atomTyping: input.atomTyping, kinematicModel: input.kinematicModel, profileId: input.profileId, provenance, digest });
  return sealResult(value, diagnostics, provenance);
};

export type D2SearchRegionInput = Readonly<{
  bindingSiteRef: string;
  preparedReceptor: D2PreparedReceptorStateV1;
  preparedLigand: D2PreparedLigandStateV1;
  coordinateFrame: D2CoordinateStateV1["coordinateFrame"];
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  paddingAngstrom: readonly [number, number, number];
  derivationMode: "EXPLICIT_BOUNDS" | "REFERENCE_LIGAND_ENVELOPE";
  referenceOccurrenceRef?: string;
  fixedAcrossLigandStates: boolean;
  wholeReceptorLike?: boolean;
}>;

const coordinateValuesFor = (state: D2CoordinateStateV1, atomUid: D2AtomUID): readonly [number, number, number] | undefined => {
  const coordinate = state.coordinates[atomUid];
  if (!coordinate || coordinate.length !== 3 || coordinate.some((value) => !isFiniteBits(value))) return undefined;
  return [f64Value(coordinate[0]), f64Value(coordinate[1]), f64Value(coordinate[2])];
};

export const isPoseAdmissibleInSearchRegion = (region: D2SearchRegionV1, heavyAtomCoordinates: readonly (readonly [number, number, number])[]): boolean => heavyAtomCoordinates.every((coordinate) => coordinate.every((value, index) => value >= f64Value(region.min[index]!) && value <= f64Value(region.max[index]!)));

export const sealSearchRegion = (input: D2SearchRegionInput): D2SealResult<D2SearchRegionV1> => {
  const diagnostics: D2Diagnostic[] = [];
  if (!input.bindingSiteRef.trim()) diagnostics.push(d2Error("INVALID_BINDING_SITE_REF", "BindingSiteIdentity reference must be explicit and non-empty."));
  if (input.preparedReceptor.coordinateState.coordinateFrame !== input.coordinateFrame) diagnostics.push(d2Error("INVALID_SEARCH_REGION_FRAME", "SearchRegion must use the exact prepared-receptor coordinate frame."));
  if (input.preparedLigand.coordinateState.coordinateFrame !== input.coordinateFrame) diagnostics.push(d2Error("INVALID_SEARCH_REGION_FRAME", "SearchRegion containment requires the ligand pose coordinates to be expressed in the same explicit coordinate frame."));
  if (input.wholeReceptorLike) diagnostics.push(d2Error("UNSUPPORTED_BLIND_LIKE_REGION", "Whole-receptor/global SearchRegion is outside ordinary V1."));
  if (input.derivationMode === "REFERENCE_LIGAND_ENVELOPE" && !input.referenceOccurrenceRef?.trim()) diagnostics.push(d2Error("AMBIGUOUS_REFERENCE_OCCURRENCE", "Reference-ligand-derived SearchRegion requires one explicit resolved occurrence reference."));
  const finiteValues = [...input.min, ...input.max, ...input.paddingAngstrom];
  if (finiteValues.some((value) => !Number.isFinite(value))) diagnostics.push(d2Error("INVALID_SEARCH_REGION_NONFINITE", "SearchRegion bounds and padding must be finite."));
  if (input.min.some((value, index) => value >= input.max[index]!)) diagnostics.push(d2Error("INVALID_SEARCH_REGION_BOUNDS", "SearchRegion min bounds must be strictly less than max bounds."));
  if (input.paddingAngstrom.some((value) => value < 0)) diagnostics.push(d2Error("INVALID_SEARCH_REGION_PADDING", "SearchRegion padding must be explicit and non-negative."));
  const extents = input.max.map((value, index) => value - input.min[index]!) as [number, number, number];
  if (extents.some((value) => value > MAX_SEARCH_REGION_SIDE_ANGSTROM)) diagnostics.push(d2Error("RESOURCE_SEARCH_REGION_SIDE_LIMIT", `SearchRegion side length must be <= ${MAX_SEARCH_REGION_SIDE_ANGSTROM} Å.`));
  const volume = extents[0] * extents[1] * extents[2];
  if (!Number.isFinite(volume) || volume > MAX_SEARCH_REGION_VOLUME_ANGSTROM3) diagnostics.push(d2Error("RESOURCE_SEARCH_REGION_VOLUME_LIMIT", `SearchRegion volume must be <= ${MAX_SEARCH_REGION_VOLUME_ANGSTROM3} Å³.`));
  const selectedComponent = input.preparedLigand.graphRevision.components.find((component) => component.componentId === input.preparedLigand.selectedComponentId);
  const heavyCoordinates = (selectedComponent?.atomUids ?? []).filter((atomUid) => input.preparedLigand.graphRevision.atoms.find((atom) => atom.atomUid === atomUid)?.element.toUpperCase() !== "H").map((atomUid) => coordinateValuesFor(input.preparedLigand.coordinateState, atomUid)).filter((coordinate): coordinate is readonly [number, number, number] => coordinate !== undefined);
  if (!selectedComponent || heavyCoordinates.length === 0) diagnostics.push(d2Error("INVALID_LIGAND_COORDINATE_ENVELOPE", "SearchRegion containment requires a selected ligand component with finite heavy-atom coordinates."));
  if (heavyCoordinates.some((coordinate) => coordinate.some((value, index) => value < input.min[index]! || value > input.max[index]!))) diagnostics.push(d2Error("INVALID_SEARCH_REGION_CONTAINMENT", "At least one prepared-ligand heavy atom lies outside the closed SearchRegion; no auto-expansion is permitted."));
  if (!input.fixedAcrossLigandStates) diagnostics.push(d2Warning("SEARCH_REGION_NOT_CAMPAIGN_FIXED", "This SearchRegion is not declared fixed across explicit ligand states."));
  const minBits = input.min.map((value) => f64Bits(value)) as [ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>];
  const maxBits = input.max.map((value) => f64Bits(value)) as [ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>];
  const centerBits = input.min.map((value, index) => f64Bits((value + input.max[index]!) / 2)) as [ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>];
  const extentBits = extents.map((value) => f64Bits(value)) as [ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>];
  const paddingBits = input.paddingAngstrom.map((value) => f64Bits(value)) as [ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>, ReturnType<typeof f64Bits>];
  const payload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_SEARCH_REGION_V1", bindingSiteRef: input.bindingSiteRef, preparedReceptorDigest: input.preparedReceptor.digest, coordinateStateDigest: input.preparedReceptor.coordinateState.digest, coordinateFrame: input.coordinateFrame, geometryType: "AXIS_ALIGNED_BOX_V1", min: minBits, max: maxBits, center: centerBits, fullExtents: extentBits, units: "ANGSTROM", boundary: "CLOSED_AABB_V1", posePolicy: "ALL_LIGAND_HEAVY_ATOMS_IN_OR_ON", derivationMode: input.derivationMode, paddingAngstrom: paddingBits, fixedAcrossLigandStates: input.fixedAcrossLigandStates, referenceOccurrenceRef: input.referenceOccurrenceRef ?? null } as const;
  const provenance = provenanceFor("SEAL_SEARCH_REGION", D2_SEARCH_REGION_PROFILE_ID, [input.preparedReceptor.digest, input.preparedLigand.digest], [{ field: "boundary", status: "PRESERVED", explanation: "Containment is closed and inclusive on all six faces." }, { field: "auto_expansion", status: "DROPPED", explanation: "Explicit bounds are never expanded to fit a larger ligand." }], [input.preparedReceptor.graphRevision.digest, input.preparedLigand.graphRevision.digest], [...input.preparedReceptor.graphRevision.sourceArtifactIds, ...input.preparedLigand.graphRevision.sourceArtifactIds]);
  const digest = scientificDigest<"SearchRegionDigest">("D2_SEARCH_REGION", "D2_SEARCH_REGION_V1", payload);
  const value: D2SearchRegionV1 = deepFreeze({ ...payload, searchRegionId: `search-region:${digest.slice(-16)}`, preparedReceptorDigest: input.preparedReceptor.digest, coordinateStateDigest: input.preparedReceptor.coordinateState.digest, coordinateFrame: input.coordinateFrame, min: minBits, max: maxBits, center: centerBits, fullExtents: extentBits, units: "ANGSTROM", boundary: "CLOSED_AABB_V1", posePolicy: "ALL_LIGAND_HEAVY_ATOMS_IN_OR_ON", derivationMode: input.derivationMode, paddingAngstrom: paddingBits, fixedAcrossLigandStates: input.fixedAcrossLigandStates, provenance, digest });
  return sealResult(value, diagnostics, provenance);
};

export type D2OrdinaryV1CapabilityInput = Readonly<{
  blindSite?: boolean;
  flexibleReceptor?: boolean;
  mobileWater?: boolean;
  covalentDocking?: boolean;
  macrocycleSpecial?: boolean;
  multiLigand?: boolean;
  unusualElements?: boolean;
  gpuExecution?: boolean;
}>;

export const assessOrdinaryV1Capability = (input: D2OrdinaryV1CapabilityInput): Readonly<{ status: D2ValidationStatus; reasonCodes: readonly string[]; executable: false }> => {
  const reasonCodes: string[] = [];
  if (input.blindSite) reasonCodes.push("BLIND_SITE_OUTSIDE_ORDINARY_V1");
  if (input.flexibleReceptor) reasonCodes.push("FLEXIBLE_RECEPTOR_UNSUPPORTED");
  if (input.mobileWater) reasonCodes.push("MOBILE_WATER_UNSUPPORTED");
  if (input.covalentDocking) reasonCodes.push("COVALENT_DOCKING_UNSUPPORTED");
  if (input.macrocycleSpecial) reasonCodes.push("MACROCYCLE_SPECIAL_UNSUPPORTED");
  if (input.multiLigand) reasonCodes.push("MULTI_LIGAND_UNSUPPORTED");
  if (input.unusualElements) reasonCodes.push("UNUSUAL_ELEMENT_UNSUPPORTED");
  if (input.gpuExecution) reasonCodes.push("GPU_EXPERIMENTAL_NOT_ORDINARY_V1");
  return Object.freeze({ status: reasonCodes.length ? "UNSUPPORTED" : "VALID", reasonCodes: Object.freeze(reasonCodes), executable: false as const });
};

export const D2_LIMITS = Object.freeze({ MAX_LIGAND_ATOMS, MAX_LIGAND_HEAVY_ATOMS, MAX_LIGAND_BONDS, MAX_SEARCH_TORSIONS, MAX_RECEPTOR_ATOMS, MAX_RECEPTOR_RESIDUES, MAX_SEARCH_REGION_SIDE_ANGSTROM, MAX_SEARCH_REGION_VOLUME_ANGSTROM3 });
