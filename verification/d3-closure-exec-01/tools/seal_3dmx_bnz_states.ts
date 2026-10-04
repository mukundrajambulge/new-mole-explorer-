import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  D2_KINEMATIC_PROFILE_ID,
  D2_LIGAND_PROFILE_ID,
  D2_RECEPTOR_PROFILE_ID,
  f64Bits,
  f64Value,
  type CanonicalMolecularStructure,
  type SourceArtifact,
  type D2AtomUID,
} from "@molecular/contracts";
import { adaptCanonicalStructure } from "../../../apps/api/src/docking/d2Adapters.js";
import { sealLigandKinematicModel, sealPreparedLigandState, sealPreparedReceptorState, sealSearchRegion } from "../../../apps/api/src/docking/d2Preparation.js";
import { scientificDigest } from "../../../apps/api/src/docking/scientificSerialization.js";
import { D3_VINA_TORSION_PROFILE_DIGEST, D3_VINA_TORSION_PROFILE_V1, importD3VinaPdbqt, sealD3VinaAuthoritativeAtomMapping } from "../../../apps/api/src/docking/d3VinaTorsion.js";

const root = path.resolve("verification/d3-closure-exec-01");
const prepared = JSON.parse(await readFile(path.join(root, "prepared_states/run-1/PREPARED_SCIENTIFIC_PAYLOAD.json"), "utf8"));
const profileConfig = JSON.parse(await readFile(path.join(root, "PREPARATION_RUN_CONFIG.json"), "utf8"));
const sourceSha = prepared.graph_state.source_hashes["3DMX.cif"].sha256;
const prepPayloadDigest = `sha256:${createHash("sha256").update(await readFile(path.join(root, "prepared_states/run-1/PREPARED_SCIENTIFIC_PAYLOAD.json"))).digest("hex")}`;
const auth04Ref = "AUTH04 owner-approved chemical-state policy and residue identity list; exact attachment SHA-256 f4526524331f33e6e0055a4cddeac083dba2aedeec52421d89d161f31c95688d";
const shaRef = (hex: string) => `sha256:${hex}`;
const must = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const outJson = async (name: string, value: unknown) => writeFile(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

type AtomRecord = Record<string, any>;
type Built = { state: any; heavy: AtomRecord[]; all: AtomRecord[]; metaByStable: Map<string, AtomRecord>; coords: Record<string, [number, number, number]>; uidByStableId: Map<string, D2AtomUID>; typing: Array<{ atomUid: D2AtomUID; typeId: string; chargeModel: string; evidenceRef: string }> };

function makeStructure(which: "receptor" | "ligand"): { structure: CanonicalMolecularStructure; sourceArtifact: SourceArtifact; sourceRows: AtomRecord[]; hydrogenRows: AtomRecord[]; metaByStable: Map<string, AtomRecord> } {
  const graph = prepared.graph_state[which];
  const sourceRows: AtomRecord[] = graph.heavy_atoms;
  const hydrogenRows: AtomRecord[] = prepared.generated_hydrogens.filter((row: AtomRecord) => row.context === which);
  const allSource = [...sourceRows, ...hydrogenRows];
  const heavyByKey = new Map(sourceRows.map((row) => [row.source_key, row]));
  const hStable = (row: AtomRecord) => row.atom_uid_material as string;
  const atoms = allSource.map((row, index) => {
    const isHydrogen = row.element === undefined;
    const parent = isHydrogen ? heavyByKey.get(row.parent_source_key) : undefined;
    const key = isHydrogen ? row.parent_source_key as string : row.source_key as string;
    const parts = key.split(":");
    must(parts.length === 4, `source key must be chain:auth-seq:comp:atom: ${key}`);
    const source = isHydrogen ? parent! : row;
    const coordinate = row.coordinate as number[];
    return {
      stableId: isHydrogen ? hStable(row) : row.source_key,
      serial: isHydrogen ? 10_000_000 + row.hydrogen_index : row.source_id,
      atomName: isHydrogen ? row.hydrogen_name : row.atom_name,
      element: isHydrogen ? "H" : row.element,
      residueName: source.comp_id,
      residueNumber: Number(source.auth_seq_id),
      chain: source.auth_asym_id,
      x: coordinate[0], y: coordinate[1], z: coordinate[2],
      recordType: which === "receptor" ? "ATOM" as const : "HETATM" as const,
      isPolymer: which === "receptor", isLigand: which === "ligand", isWater: false, isIon: false,
      formalCharge: row.formal_charge ?? 0,
      occupancy: isHydrogen ? 1 : row.occupancy,
      altLoc: isHydrogen || row.altloc === "(blank)" ? null : row.altloc,
      __row: row,
    };
  });
  const residues = new Map<string, any>();
  for (const atom of atoms) {
    const id = `${atom.residueName}:${atom.chain}:${atom.residueNumber}`;
    const residue = residues.get(id) ?? { id, name: atom.residueName, number: atom.residueNumber, chainId: atom.chain, atomIds: [], isPolymer: which === "receptor" };
    residue.atomIds.push(atom.stableId);
    residues.set(id, residue);
  }
  const residueRows = [...residues.values()].sort((a, b) => a.chainId.localeCompare(b.chainId) || a.number - b.number);
  const chainIds = [...new Set(residueRows.map((row) => row.chainId))].sort();
  const hierarchy = {
    chainIds,
    chains: Object.fromEntries(chainIds.map((chainId) => [chainId, { id: chainId, name: chainId, residueIds: residueRows.filter((r) => r.chainId === chainId).map((r) => r.id) }])),
    residues: Object.fromEntries(residueRows.map((row) => [row.id, row])),
  };
  const bondRows = graph.heavy_bonds.map((bond: AtomRecord, index: number) => ({ id: `heavy:${index}:${bond.atom1_key}:${bond.atom2_key}`, atom1: bond.atom1_key, atom2: bond.atom2_key, order: bond.order, source: bond.evidence === "SOURCE_EXPLICIT" ? "MMCIF_CHEM_COMP_BOND" as const : "MMCIF_GEOM_BOND" as const }));
  for (const [index, hydrogen] of hydrogenRows.entries()) bondRows.push({ id: `generated-h:${index}:${hydrogen.atom_uid_material}`, atom1: hydrogen.parent_source_key, atom2: hydrogen.atom_uid_material, order: "SINGLE" as const, source: "MMCIF_GEOM_BOND" as const });
  const xyz = atoms.map(({ x, y, z }) => [x, y, z]);
  const axes = [0, 1, 2].map((i) => xyz.map((v) => v[i]!));
  const sourceUrl = which === "receptor" ? "https://files.rcsb.org/download/3DMX.cif" : "https://files.rcsb.org/download/3DMX.cif";
  const sourceId = "source:3DMX-byte-exact-coordinate-state";
  const artifact: SourceArtifact = {
    schemaVersion: 1, sourceArtifactId: sourceId, acquisitionKind: "REMOTE_HTTP", sourceUri: sourceUrl,
    originalFilename: "3DMX.cif", mediaType: "chemical/x-mmcif", byteLength: 218104, sha256: sourceSha,
    acquiredAt: "2026-10-04T00:00:00.000Z", format: "mmcif", formatEvidence: [{ kind: "CONTENT_SIGNATURE", value: "mmCIF _atom_site" }], parserProfile: "D3-CLOSURE-EXEC-01 source-profile preparation adapter v1.1.0",
  };
  const coords = Object.fromEntries(atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }]));
  const strippedAtoms = atoms.map(({ __row: _row, ...atom }) => atom);
  const structure: CanonicalMolecularStructure = {
    id: `d3-${which}-3dmx-bnz-prepared`, name: which === "receptor" ? "3DMX receptor polymer assembly 1" : "3DMX BNZ reference ligand",
    format: "mmcif",
    source: { kind: "RCSB", originalFilename: "3DMX.cif", format: "mmcif", sha256: sourceSha, byteLength: 218104, uri: sourceUrl,
      ingestedAt: "2026-10-04T00:00:00.000Z", parserProfile: artifact.parserProfile, sourceArtifactId: sourceId, acquisitionKind: "REMOTE_HTTP", mediaType: artifact.mediaType, formatEvidence: artifact.formatEvidence },
    counts: { atoms: atoms.length, residues: residueRows.length, chains: chainIds.length, polymerAtoms: which === "receptor" ? atoms.length : 0, ligandAtoms: which === "ligand" ? atoms.length : 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
    bounds: { min: { x: Math.min(...axes[0]!), y: Math.min(...axes[1]!), z: Math.min(...axes[2]!) }, max: { x: Math.max(...axes[0]!), y: Math.max(...axes[1]!), z: Math.max(...axes[2]!) } },
    atoms: strippedAtoms,
    bonds: bondRows,
    hierarchy,
    scientificHash: sourceSha,
    coordinateStates: [{ id: "3dmx-model-1-prepared", ordinal: 1, sourceModelNumber: 1, coordinates: coords, coordinateHash: prepPayloadDigest }],
    stateOrder: ["3dmx-model-1-prepared"],
  };
  const metaByStable = new Map(allSource.map((row) => [row.element === undefined ? hStable(row) : row.source_key, row]));
  return { structure, sourceArtifact: artifact, sourceRows, hydrogenRows, metaByStable };
}

function explicitD2(which: "receptor" | "ligand"): Built {
  const { structure, sourceArtifact, sourceRows, hydrogenRows, metaByStable } = makeStructure(which);
  const adapted = adaptCanonicalStructure({ structure, sourceArtifact, mmcifNamespaceMode: "PRESERVED_AUTH_AND_LABEL" });
  must(adapted.status === "VALID" && adapted.value?.graph && adapted.value.identity, `${which} canonical graph adaptation failed: ${JSON.stringify(adapted.diagnostics)}`);
  const base = adapted.value;
  const hydrogenStable = new Set(hydrogenRows.map((row) => row.atom_uid_material));
  const graphAtoms = base.graph!.atoms.map((atom, index) => {
    const canonical = structure.atoms[index]!;
    const stableId = canonical.stableId;
    if (hydrogenStable.has(stableId)) {
      return { ...atom, aliases: [{ sourceNamespace: "INTERNAL", sourceIndex: structure.atoms.indexOf(canonical), chainId: canonical.chain, residueId: `${canonical.residueName}:${canonical.residueNumber}`, atomName: canonical.atomName }] };
    }
    const source = metaByStable.get(stableId)!;
    const alias = atom.aliases[0]!;
    const labelSeq = source.label_seq_id;
    const labelAlias = { ...alias, sourceNamespace: "MMCIF_LABEL" as const, chainId: source.label_asym_id, residueId: labelSeq === null ? `${source.comp_id}:${source.label_asym_id}:${source.auth_seq_id}` : `${source.comp_id}:${labelSeq}`, atomName: source.atom_name, ...(source.altloc === "(blank)" ? {} : { altLoc: source.altloc }) };
    return { ...atom, aliases: [alias, labelAlias] };
  });
  const graphPayload = { schemaVersion: base.graph!.schemaVersion, semanticSchemaId: base.graph!.semanticSchemaId, atoms: graphAtoms, bonds: base.graph!.bonds, components: base.graph!.components, sourceArtifactIds: base.graph!.sourceArtifactIds };
  const graphDigest = scientificDigest<any>("D2_MOLECULAR_GRAPH", "D2_MOLECULAR_GRAPH_REVISION_V1", graphPayload);
  const graphRevision = { ...graphPayload, revisionId: `graph:${graphDigest.slice(-16)}`, digest: graphDigest };
  const identityPayload = { schemaVersion: 1, semanticSchemaId: "D2_MOLECULAR_IDENTITY_V1", graphRevisionDigest: graphRevision.digest, sourceArtifactRefs: [{ sourceArtifactId: base.sourceArtifactId, artifactByteDigest: base.sourceArtifactDigest }] };
  const identityDigest = scientificDigest<any>("D2_MOLECULAR_IDENTITY", "D2_MOLECULAR_IDENTITY_V1", identityPayload);
  const identity = { ...identityPayload, identityId: `molecular:${identityDigest.slice(-16)}`, digest: identityDigest };
  const selectedComponents = which === "ligand" ? graphRevision.components.filter((component: any) => component.role === "LIGAND") : graphRevision.components.filter((component: any) => component.role === "POLYMER");
  must(selectedComponents.length === (which === "ligand" ? 1 : 164), `${which} component selection must be complete, got ${selectedComponents.length}`);
  const charges: Record<string, number | null> = {};
  for (const sourceAtom of structure.atoms) {
    const atom = graphRevision.atoms[structure.atoms.indexOf(sourceAtom)]!;
    charges[atom.atomUid] = sourceAtom.formalCharge ?? null;
  }
  const chemicalPayload = {
    schemaVersion: 1, semanticSchemaId: "D2_CHEMICAL_STATE_V1", molecularIdentityDigest: identity.digest,
    resolution: "EXPLICIT_DERIVED_PROFILE", protonationStatus: which === "receptor" ? "EXPLICIT" : "NOT_APPLICABLE",
    tautomerStatus: which === "receptor" ? "EXPLICIT" : "NOT_APPLICABLE", ...(which === "receptor" ? { protonationProfileId: "ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1" } : {}),
    formalCharges: charges, stereo: [], selectedComponentIds: selectedComponents.map((component: any) => component.componentId),
    sourceEvidenceRefs: [sourceSha, prepared.graph_state.source_hashes["BNZ.cif"].sha256, "AUTH04_OWNER_APPROVED_STATE_POLICY"],
  };
  const chemicalDigest = scientificDigest<any>("D2_CHEMICAL_STATE", "D2_CHEMICAL_STATE_V1", chemicalPayload);
  const chemicalState = { ...chemicalPayload, stateId: `chemical:${chemicalDigest.slice(-16)}`, digest: chemicalDigest };
  const coordinateMap = Object.fromEntries(structure.atoms.map((sourceAtom, index) => {
    const atom = graphRevision.atoms[index]!;
    return [atom.atomUid, [f64Bits(sourceAtom.x), f64Bits(sourceAtom.y), f64Bits(sourceAtom.z)]];
  }));
  const coordinatePayload = { schemaVersion: 1, semanticSchemaId: "D2_COORDINATE_STATE_V1", chemicalStateDigest: chemicalState.digest, sourceModelNumber: 1,
    coordinateFrame: "receptor-source-frame", coordinateUnits: "ANGSTROM", dimensionality: 3, origin: [f64Bits(0), f64Bits(0), f64Bits(0)], coordinates: coordinateMap, sourceArtifactRefs: [base.sourceArtifactDigest] };
  const coordinateDigest = scientificDigest<any>("D2_COORDINATE_STATE", "D2_COORDINATE_STATE_V1", coordinatePayload);
  const coordinateState = { ...coordinatePayload, stateId: `coordinates:${coordinateDigest.slice(-16)}`, digest: coordinateDigest };
  const typing = graphRevision.atoms.map((atom: any) => ({ atomUid: atom.atomUid, typeId: atom.element === "H" ? "H_EXCLUDED_FROM_XS_SCORING" : which === "ligand" ? "C_H" : "UNASSIGNED_RECEPTOR_TYPING", chargeModel: "AUTH04_EXPLICIT_FORMAL_CHARGE_NO_PARTIAL_CHARGE_SCORING", evidenceRef: atom.element === "H" ? "HYDROGEN_PROVENANCE.json" : auth04Ref }));
  return { state: { identity, graphRevision, chemicalState, coordinateState, selectedComponents, profileId: which === "receptor" ? D2_RECEPTOR_PROFILE_ID : D2_LIGAND_PROFILE_ID }, heavy: sourceRows, all: structure.atoms, metaByStable, coords: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, [atom.x, atom.y, atom.z]])), uidByStableId: new Map(structure.atoms.map((atom, i) => [atom.stableId, graphRevision.atoms[i]!.atomUid])), typing };
}

// Atom feature roles are the explicit protein-residue role rules consumed by the pinned XS primitive.
function receptorRole(residue: string, seq: number, name: string): [boolean, boolean] {
  if (name === "N") return [residue !== "PRO", false];
  if (name === "O" || name === "OXT") return [false, true];
  if (residue === "ASN") { if (name === "ND2") return [true, false]; if (name === "OD1") return [false, true]; }
  if (residue === "GLN") { if (name === "NE2") return [true, false]; if (name === "OE1") return [false, true]; }
  if (residue === "ASP" && (name === "OD1" || name === "OD2")) return [false, true];
  if (residue === "GLU" && (name === "OE1" || name === "OE2")) return [false, true];
  if (residue === "ARG" && ["NE", "NH1", "NH2"].includes(name)) return [true, false];
  if (residue === "LYS" && name === "NZ") return [true, false];
  if (residue === "HIS" && seq === 31 && name === "ND1") return [true, false];
  if (residue === "HIS" && seq === 31 && name === "NE2") return [false, true];
  if (["SER", "THR", "TYR"].includes(residue) && ["OG", "OG1", "OH"].includes(name)) return [true, true];
  if (residue === "TRP" && name === "NE1") return [true, false];
  return [false, false];
}

function assignTypes(built: Built, which: "receptor" | "ligand") {
  const graph = built.state.graphRevision;
  const atomByUid = new Map(graph.atoms.map((atom: any) => [atom.atomUid, atom]));
  const neighbors = new Map<string, any[]>();
  for (const atom of graph.atoms) neighbors.set(atom.atomUid, []);
  for (const bond of graph.bonds) { neighbors.get(bond.atom1Uid)!.push(atomByUid.get(bond.atom2Uid)); neighbors.get(bond.atom2Uid)!.push(atomByUid.get(bond.atom1Uid)); }
  const roles = new Map<string, [boolean, boolean]>();
  for (const atom of graph.atoms) {
    if (atom.element !== "N" && atom.element !== "O") continue;
    if (which === "ligand") roles.set(atom.atomUid, [false, false]);
    else {
      const contextAtom = (built.all[graph.atoms.indexOf(atom)] as any);
      roles.set(atom.atomUid, receptorRole(contextAtom.residueName, contextAtom.residueNumber, atom.atomName));
    }
  }
  const rows = graph.atoms.filter((atom: any) => atom.element !== "H").map((atom: any) => {
    let typeId: string;
    if (atom.element === "C") {
      const polar = neighbors.get(atom.atomUid)!.some((neighbor: any) => neighbor && !["H", "C"].includes(neighbor.element));
      typeId = polar ? "C_P" : "C_H";
    } else if (atom.element === "N" || atom.element === "O") {
      const [donor, acceptor] = roles.get(atom.atomUid) ?? [false, false];
      typeId = `${atom.element}_${donor && acceptor ? "DA" : donor ? "D" : acceptor ? "A" : "P"}`;
    } else if (atom.element === "S") typeId = "S_P";
    else if (atom.element === "P") typeId = "P_P";
    else if (atom.element === "F") typeId = "F_H";
    else if (atom.element === "CL") typeId = "Cl_H";
    else if (atom.element === "BR") typeId = "Br_H";
    else if (atom.element === "I") typeId = "I_H";
    else throw new Error(`unsupported element for XS typing: ${atom.element}`);
    return { atomUid: atom.atomUid, typeId, chargeModel: "AUTH04_EXPLICIT_STATE_NO_IMPORTED_PARTIAL_CHARGE", evidenceRef: `${auth04Ref}; ME_XS_TYPING_V1_1_0; atom:${atom.atomName}` };
  });
  return rows;
}

function checkSeal(label: string, result: any) { must(result.status === "VALID" && result.value, `${label} seal failed: ${JSON.stringify(result.diagnostics)}`); return result.value; }
const xyzByUid = (state: any) => Object.fromEntries(state.graphRevision.atoms.map((atom: any) => [atom.atomUid, state.coordinateState.coordinates[atom.atomUid].map((bits: any) => f64Value(bits))]));

const receptor = explicitD2("receptor");
const ligand = explicitD2("ligand");
const receptorTypeRows = assignTypes(receptor, "receptor");
const ligandTypeRows = assignTypes(ligand, "ligand");
receptor.typing = receptor.typing.map((row) => { const t = receptorTypeRows.find((x) => x.atomUid === row.atomUid); return t ?? row; });
ligand.typing = ligand.typing.map((row) => { const t = ligandTypeRows.find((x) => x.atomUid === row.atomUid); return t ?? row; });

const selectedAltlocs = { "ASN68": "A", "ASP72": "A", "ARG76": "A", "MET106": "A", "GLU108": "A" };
const membershipDigest = scientificDigest<any>("D3_RECEPTOR_ASSEMBLY_MEMBERSHIP", "D3_RECEPTOR_ASSEMBLY_MEMBERSHIP_V1", { assembly: 1, model: 1, chain: "A", sourceSha });
const receptorSeal = checkSeal("PreparedReceptorState", sealPreparedReceptorState({
  receptorIdentity: receptor.state.identity, graphRevision: receptor.state.graphRevision, chemicalState: receptor.state.chemicalState, coordinateState: receptor.state.coordinateState,
  assembly: { selectionKind: "EXPLICIT_ASSEMBLY", assemblyId: "1", membershipDigest }, modelNumber: 1, chainIds: ["A"],
  altlocResolution: { policy: "COHERENT_MAX_OCCUPANCY_V1", status: "UNIQUE", selectedLabels: selectedAltlocs, evidenceRef: "PROFILE_COMPLETENESS_VALIDATION.json; unique coherent maximum occupancy A at all five enumerated source groups" },
  componentRoles: receptor.state.selectedComponents.map((component: any) => ({ componentId: component.componentId, role: "CORE", evidenceRefs: ["SOURCE_PROFILE_COMPLETENESS_MATRIX.csv", auth04Ref] })),
  profileId: D2_RECEPTOR_PROFILE_ID, siteCriticalAtomUids: receptor.state.graphRevision.atoms.filter((atom: any) => atom.element !== "H").map((atom: any) => atom.atomUid),
}));
must(receptor.state.graphRevision.atoms.every((atom: any) => ["H","C","N","O","F","P","S","CL","BR","I"].includes(atom.element.toUpperCase())), "receptor contains an element outside the sealed D2 core vocabulary");
const ligandKinematic = checkSeal("LigandKinematicModel", sealLigandKinematicModel({ molecularIdentityDigest: ligand.state.identity.digest, graphRevision: ligand.state.graphRevision,
  rootAtomUid: ligand.uidByStableId.get("G:900:BNZ:C1")!, fragments: [{ fragmentId: "bnz-rigid-aromatic", atomUids: ligand.state.graphRevision.atoms.map((atom: any) => atom.atomUid) }], rotatableEdges: [], profileId: D2_KINEMATIC_PROFILE_ID }));
const ligandSeal = checkSeal("PreparedLigandState", sealPreparedLigandState({ molecularIdentity: ligand.state.identity, graphRevision: ligand.state.graphRevision, chemicalState: ligand.state.chemicalState,
  coordinateState: ligand.state.coordinateState, selectedComponentId: ligand.state.selectedComponents[0].componentId, atomTyping: ligand.typing, kinematicModel: ligandKinematic, profileId: D2_LIGAND_PROFILE_ID }));
must(ligandSeal.graphRevision.atoms.every((atom: any) => ["H","C","N","O","F","P","S","CL","BR","I"].includes(atom.element.toUpperCase())), "ligand contains an element outside the sealed D2 core vocabulary");

const torsionDir = path.join(root, "torsion");
await import("node:fs/promises").then(({ mkdir }) => mkdir(torsionDir, { recursive: true }));
const ligandGraphAtoms = ligandSeal.graphRevision.atoms;
const ligandSourceAtoms = ligand.all;
const ligandXYZ = xyzByUid(ligandSeal);
const pdbqtRows = ligandGraphAtoms.map((atom: any, index: number) => {
  const xyz = ligandXYZ[atom.atomUid] as number[];
  const serial = index + 1;
  const atomName = atom.atomName;
  const x = xyz[0]!.toFixed(3).padStart(8); const y = xyz[1]!.toFixed(3).padStart(8); const z = xyz[2]!.toFixed(3).padStart(8);
  const atomType = atom.element === "C" ? "A" : atom.element === "H" ? "H" : atom.element;
  return { atom, serial, line: `ATOM  ${String(serial).padStart(5)} ${atomName.padEnd(4)} BNZ G 900    ${x}${y}${z}${"1.00".padStart(6)}${"0.00".padStart(6)}    0.000 ${atomType}` };
});
const pdbqtText = [`ROOT`, ...pdbqtRows.map((row) => row.line), `ENDROOT`, `TORSDOF 0`, ``].join("\n");
const pdbqtBytes = new TextEncoder().encode(pdbqtText);
const pdbqtSha = createHash("sha256").update(pdbqtBytes).digest("hex");
const pdbqtSource: SourceArtifact = { schemaVersion: 1, sourceArtifactId: "source:d3-closure-bnz-rigid-torsion-representation", acquisitionKind: "DERIVED_EXPORT", originalFilename: "3dmx-bnz-rigid-torsion-evidence.pdbqt", mediaType: "chemical/x-pdbqt", byteLength: pdbqtBytes.byteLength, sha256: pdbqtSha, acquiredAt: "2026-10-05T00:00:00.000Z", format: "pdbqt", formatEvidence: [{ kind: "EXPLICIT_DECLARATION", value: "deterministic serialization from sealed BNZ D2 graph for zero-rotor torsion accounting only" }], parserProfile: "D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1", parentExportArtifactId: String(ligandSeal.molecularIdentity.sourceArtifactRefs[0].sourceArtifactId) };
const mapping = checkSeal("D3 Vina atom mapping", sealD3VinaAuthoritativeAtomMapping({ graph: ligandSeal.graphRevision, representationArtifactDigest: shaRef(pdbqtSha), serialToAtomUid: Object.fromEntries(pdbqtRows.map((row) => [String(row.serial), row.atom.atomUid])), evidenceRefs: ["D2_SEALED_STATE_SUMMARY.json", "PREPARED_SCIENTIFIC_PAYLOAD.json", "VALIDATION_POSE_COHORT.json"] }));
const torsionImport = importD3VinaPdbqt({ bytes: pdbqtBytes, sourceArtifact: pdbqtSource, graph: ligandSeal.graphRevision, mapping,
  producer: { status: "KNOWN", name: "D3-CLOSURE-EXEC-01 deterministic reference-ligand serialization", version: "1.0.0", settingsRefs: ["sealed BNZ graph; ROOT-only; no BRANCH records; TORSDOF 0"] } });
must(torsionImport.status === "VALID" && torsionImport.value, `D3 Vina torsion evidence failed: ${JSON.stringify(torsionImport.diagnostics)}`);
await writeFile(path.join(torsionDir, "reference-ligand-zero-torsion.pdbqt"), pdbqtBytes);
await outJson("torsion/D3_VINA_SCORER_TORSION_ASSIGNMENT.json", { ...torsionImport.value!.scorerTorsionAssignment, nTorsVina: f64Value(torsionImport.value!.scorerTorsionAssignment.nTorsVina), sourceArtifact: { sourceArtifactId: pdbqtSource.sourceArtifactId, byteLength: pdbqtSource.byteLength, sha256: pdbqtSha }, searchTorsionCount: torsionImport.value!.searchTopology.activeSearchTorsionCount });
await outJson("torsion/D3_VINA_TORSION_EVIDENCE.json", { status: torsionImport.status, profileId: torsionImport.value!.scorerTorsionAssignment.profileId,
  profileDigest: torsionImport.value!.scorerTorsionAssignment.profileDigest, sourceEvidence: torsionImport.value!.sourceEvidence, searchTopology: torsionImport.value!.searchTopology,
  scorerTorsionAssignment: torsionImport.value!.scorerTorsionAssignment, sourceArtifact: pdbqtSource, producerSerializationNote: "Derived execution representation used only to run the pinned graph-bound torsion mapper; it was not used for atom identity, coordinates, chemical state, typing, or scoring." });

const ligandCoordinates = xyzByUid(ligandSeal);
const receptorCoordinates = xyzByUid(receptorSeal);
const ligandHeavyAtoms = ligandSeal.graphRevision.atoms.filter((atom: any) => atom.element !== "H");
const receptorHeavyAtoms = receptorSeal.graphRevision.atoms.filter((atom: any) => atom.element !== "H");
const ligandHeavyXYZ = ligandHeavyAtoms.map((atom: any) => ligandCoordinates[atom.atomUid] as number[]);
const ligandMin = [0, 1, 2].map((axis) => Math.min(...ligandHeavyXYZ.map((xyz: number[]) => xyz[axis]!)));
const ligandMax = [0, 1, 2].map((axis) => Math.max(...ligandHeavyXYZ.map((xyz: number[]) => xyz[axis]!)));
const rotationOrigin = ligandMin.map((value, axis) => (value + ligandMax[axis]!) / 2);
const transformPose = (xyz: number[], translation: number[], axis: number[], angle: number, origin: number[]) => {
  if (angle === 0) return xyz.map((value, index) => value + translation[index]!);
  const norm = Math.hypot(...axis); const unit = axis.map((v) => v / norm);
  const d = xyz.map((v, i) => v - origin[i]!); const cosine = Math.cos(angle); const sine = Math.sin(angle);
  const dot = unit.reduce((sum, v, i) => sum + v * d[i]!, 0);
  const cross = [unit[1]! * d[2]! - unit[2]! * d[1]!, unit[2]! * d[0]! - unit[0]! * d[2]!, unit[0]! * d[1]! - unit[1]! * d[0]!];
  return d.map((v, i) => origin[i]! + v * cosine + cross[i]! * sine + unit[i]! * dot * (1 - cosine) + translation[i]!);
};
let nearest: { distance: number; receptorAtomUid: string; ligandAtomUid: string; receptor: number[]; ligand: number[] } | undefined;
for (const r of receptorHeavyAtoms) for (const l of ligandHeavyAtoms) {
  const rc = receptorCoordinates[r.atomUid] as number[]; const lc = ligandCoordinates[l.atomUid] as number[];
  const distance = Math.hypot(...rc.map((v, i) => v - lc[i]!));
  if (!nearest || distance < nearest.distance || (distance === nearest.distance && `${r.atomUid}|${l.atomUid}` < `${nearest.receptorAtomUid}|${nearest.ligandAtomUid}`)) nearest = { distance, receptorAtomUid: r.atomUid, ligandAtomUid: l.atomUid, receptor: rc, ligand: lc };
}
must(nearest && nearest.distance < 8.0 && nearest.distance > 0, "an unambiguous finite crystal contact below the 8.0 Å pair cutoff is required");
const away = nearest.ligand.map((v, i) => (v - nearest.receptor[i]!) / nearest.distance);
const cutoffTranslation = away.map((v) => v * (8.0 - nearest!.distance));
const poseSpecs = [
  { poseId: "3dmx-crystal", cohortClass: "CRYSTAL", cutoffStress: false, translationAngstrom: [0,0,0], rotationAxis: [0,0,1], rotationAngleRadians: 0, rotationOriginAngstrom: rotationOrigin },
  { poseId: "validation-translation", cohortClass: "TRANSLATION", cutoffStress: false, translationAngstrom: [0.25,0,0], rotationAxis: [0,0,1], rotationAngleRadians: 0, rotationOriginAngstrom: rotationOrigin },
  { poseId: "validation-rotation", cohortClass: "ROTATION", cutoffStress: false, translationAngstrom: [0,0,0], rotationAxis: [0,0,1], rotationAngleRadians: 0.12, rotationOriginAngstrom: rotationOrigin },
  { poseId: "validation-combined", cohortClass: "COMBINED", cutoffStress: false, translationAngstrom: [0.125,-0.125,0], rotationAxis: [0,0,1], rotationAngleRadians: 0.08, rotationOriginAngstrom: rotationOrigin },
  { poseId: "validation-grid-phase-half-cell", cohortClass: "GRID_PHASE", cutoffStress: false, translationAngstrom: [0.1875,0,0], rotationAxis: [0,0,1], rotationAngleRadians: 0, rotationOriginAngstrom: rotationOrigin },
  { poseId: "cutoff-exact-8A", cohortClass: "TRANSLATION", cutoffStress: true, translationAngstrom: cutoffTranslation, rotationAxis: [0,0,1], rotationAngleRadians: 0, rotationOriginAngstrom: rotationOrigin },
];
const transformed = poseSpecs.flatMap((pose) => ligandHeavyAtoms.map((atom: any) => transformPose(ligandCoordinates[atom.atomUid] as number[], pose.translationAngstrom, pose.rotationAxis, pose.rotationAngleRadians, pose.rotationOriginAngstrom)));
const regionMin = [0, 1, 2].map((axis) => Math.min(...transformed.map((xyz: number[]) => xyz[axis]!)));
const regionMax = [0, 1, 2].map((axis) => Math.max(...transformed.map((xyz: number[]) => xyz[axis]!)));
const cutoffDistanceAfter = Math.hypot(...nearest.ligand.map((v, i) => v + cutoffTranslation[i]! - nearest.receptor[i]!));
must(Math.abs(cutoffDistanceAfter - 8.0) < 1e-12, `cutoff-stress transform must put the nominated atom pair exactly at 8.0 Å, got ${cutoffDistanceAfter}`);
const regionSeal = checkSeal("SearchRegion", sealSearchRegion({ bindingSiteRef: "3DMX model 1 / label asym G / BNZ / six deterministic full-pose validation transforms", preparedReceptor: receptorSeal, preparedLigand: ligandSeal,
  coordinateFrame: receptorSeal.coordinateState.coordinateFrame, min: regionMin, max: regionMax, paddingAngstrom: [0, 0, 0], derivationMode: "EXPLICIT_BOUNDS", fixedAcrossLigandStates: true }));
const expectedStateClasses: Record<string, { component: string; charge: number }> = { ASP_DEPROTONATED: { component: "ASP", charge: -1 }, GLU_DEPROTONATED: { component: "GLU", charge: -1 },
  ARG_PROTONATED: { component: "ARG", charge: 1 }, LYS_PROTONATED: { component: "LYS", charge: 1 }, TYR_NEUTRAL: { component: "TYR", charge: 0 }, HIS31_NEUTRAL_HID: { component: "HIS", charge: 0 } };
const chargeAudit: any[] = [];
for (const [stateClass, positions] of Object.entries(profileConfig.chemical_state_assignments as Record<string, number[]>)) {
  const rule = expectedStateClasses[stateClass];
  must(rule, `unknown AUTH04 state class in preparation profile: ${stateClass}`);
  for (const position of positions) {
    const selected = receptorSeal.graphRevision.atoms.map((atom: any, index: number) => ({ atom, source: receptor.metaByStable.get(receptor.all[index]!.stableId) }))
      .filter((row: any) => row.source?.auth_asym_id === "A" && Number(row.source.auth_seq_id) === position && row.source.comp_id === rule.component);
    must(selected.length > 0, `approved chemical-state residue missing from selected receptor: ${stateClass} ${rule.component}${position}`);
    const residueCharge = selected.reduce((sum: number, row: any) => sum + Number(receptorSeal.chemicalState.formalCharges[row.atom.atomUid] ?? 0), 0);
    must(residueCharge === rule.charge, `approved residue formal-charge mismatch for ${stateClass} ${rule.component}${position}: ${residueCharge}`);
    chargeAudit.push({ residue: `${rule.component}${position}`, stateClass, formalCharge: residueCharge, atomCount: selected.length });
  }
}
const terminalChecks = [
  { residue: "MET1", atomName: "N", charge: 1 },
  { residue: "LEU164", atomName: "OXT", charge: -1 },
].map((expected) => {
  const selected = receptorSeal.graphRevision.atoms.map((atom: any, index: number) => ({ atom, source: receptor.metaByStable.get(receptor.all[index]!.stableId) }))
    .filter((row: any) => `${row.source?.comp_id}${row.source?.auth_seq_id}` === expected.residue && row.atom.atomName === expected.atomName);
  must(selected.length === 1 && receptorSeal.chemicalState.formalCharges[selected[0]!.atom.atomUid] === expected.charge, `terminal chemical-state charge mismatch for ${expected.residue}.${expected.atomName}`);
  return { ...expected, atomUid: selected[0]!.atom.atomUid };
});
must(chargeAudit.length === 51, `expected 51 owner-approved state-sensitive side chains, got ${chargeAudit.length}`);
await outJson("STATE_CHARGE_VALIDATION.json", { status: "PASS", profileId: profileConfig.profile_id, targetPHProxy: "6.9", stateSensitiveSideChains: chargeAudit.length,
  formalChargeAssignments: chargeAudit, termini: terminalChecks, noAutomaticStateSelection: true, sourceChargeSummaryReconciled: true });
const digestChecks: Record<string, { expected: string; actual: string; pass: boolean }> = {};
const checkDigest = (label: string, digestClass: string, schemaId: string, payload: unknown, actual: string) => {
  const expected = scientificDigest<any>(digestClass, schemaId, payload);
  digestChecks[label] = { expected, actual, pass: expected === actual };
  must(expected === actual, `independent canonical digest replay failed for ${label}: ${expected} != ${actual}`);
};
for (const [label, built] of [["receptor", receptor], ["ligand", ligand]] as const) {
  const state = label === "receptor" ? receptorSeal : ligandSeal;
  const graph = state.graphRevision;
  const graphPayload = { schemaVersion: graph.schemaVersion, semanticSchemaId: graph.semanticSchemaId, atoms: graph.atoms, bonds: graph.bonds, components: graph.components, sourceArtifactIds: graph.sourceArtifactIds };
  checkDigest(`${label}.graph`, "D2_MOLECULAR_GRAPH", "D2_MOLECULAR_GRAPH_REVISION_V1", graphPayload, graph.digest);
  const identityPayload = { schemaVersion: 1, semanticSchemaId: "D2_MOLECULAR_IDENTITY_V1", graphRevisionDigest: graph.digest, sourceArtifactRefs: state.receptorIdentity?.sourceArtifactRefs ?? state.molecularIdentity?.sourceArtifactRefs };
  checkDigest(`${label}.identity`, "D2_MOLECULAR_IDENTITY", "D2_MOLECULAR_IDENTITY_V1", identityPayload, state.receptorIdentity?.digest ?? state.molecularIdentity?.digest);
  const chemical = state.chemicalState;
  const chemicalPayload = { schemaVersion: chemical.schemaVersion, semanticSchemaId: chemical.semanticSchemaId, molecularIdentityDigest: chemical.molecularIdentityDigest,
    resolution: chemical.resolution, protonationStatus: chemical.protonationStatus, tautomerStatus: chemical.tautomerStatus,
    ...(chemical.targetPH !== undefined ? { targetPH: chemical.targetPH } : {}), ...(chemical.protonationProfileId !== undefined ? { protonationProfileId: chemical.protonationProfileId } : {}),
    ...(chemical.tautomerStateId !== undefined ? { tautomerStateId: chemical.tautomerStateId } : {}), formalCharges: chemical.formalCharges, stereo: chemical.stereo,
    selectedComponentIds: chemical.selectedComponentIds, sourceEvidenceRefs: chemical.sourceEvidenceRefs };
  checkDigest(`${label}.chemicalState`, "D2_CHEMICAL_STATE", "D2_CHEMICAL_STATE_V1", chemicalPayload, chemical.digest);
  const coordinate = state.coordinateState;
  const coordinatePayload = { schemaVersion: coordinate.schemaVersion, semanticSchemaId: coordinate.semanticSchemaId, chemicalStateDigest: coordinate.chemicalStateDigest,
    ...(coordinate.sourceModelNumber !== undefined ? { sourceModelNumber: coordinate.sourceModelNumber } : {}), coordinateFrame: coordinate.coordinateFrame,
    coordinateUnits: coordinate.coordinateUnits, dimensionality: coordinate.dimensionality, origin: coordinate.origin, coordinates: coordinate.coordinates,
    sourceArtifactRefs: coordinate.sourceArtifactRefs };
  checkDigest(`${label}.coordinateState`, "D2_COORDINATE_STATE", "D2_COORDINATE_STATE_V1", coordinatePayload, coordinate.digest);
  if (label === "receptor") {
    const receptorPayload = { schemaVersion: state.schemaVersion, semanticSchemaId: state.semanticSchemaId, receptorIdentityDigest: state.receptorIdentity.digest,
      graphRevisionDigest: state.graphRevision.digest, chemicalStateDigest: state.chemicalState.digest, coordinateStateDigest: state.coordinateState.digest,
      assembly: state.assembly, modelNumber: state.modelNumber, chainIds: state.chainIds, altlocResolution: state.altlocResolution,
      componentRoles: state.componentRoles, profileId: state.profileId, siteCriticalAtomUids: state.siteCriticalAtomUids };
    checkDigest("preparedReceptor", "D2_PREPARED_RECEPTOR_STATE", "D2_PREPARED_RECEPTOR_STATE_V1", receptorPayload, state.digest);
  } else {
    const kinematic = state.kinematicModel;
    const kinematicPayload = { schemaVersion: kinematic.schemaVersion, semanticSchemaId: kinematic.semanticSchemaId, molecularIdentityDigest: kinematic.molecularIdentityDigest,
      rootAtomUid: kinematic.rootAtomUid, fragments: kinematic.fragments, rotatableEdges: kinematic.rotatableEdges, searchTorsionCount: kinematic.searchTorsionCount,
      scorerTorsionCount: kinematic.scorerTorsionCount, profileId: kinematic.profileId };
    checkDigest("ligandKinematicModel", "D2_LIGAND_KINEMATIC_MODEL", "D2_LIGAND_KINEMATIC_MODEL_V1", kinematicPayload, kinematic.digest);
    const ligandPayload = { schemaVersion: state.schemaVersion, semanticSchemaId: state.semanticSchemaId, molecularIdentityDigest: state.molecularIdentity.digest,
      graphRevisionDigest: state.graphRevision.digest, chemicalStateDigest: state.chemicalState.digest, coordinateStateDigest: state.coordinateState.digest,
      selectedComponentId: state.selectedComponentId, atomTyping: state.atomTyping, kinematicModelDigest: kinematic.digest, profileId: state.profileId };
    checkDigest("preparedLigand", "D2_PREPARED_LIGAND_STATE", "D2_PREPARED_LIGAND_STATE_V1", ligandPayload, state.digest);
  }
}
const searchRegionPayload = { schemaVersion: regionSeal.schemaVersion, semanticSchemaId: regionSeal.semanticSchemaId, bindingSiteRef: regionSeal.bindingSiteRef,
  preparedReceptorDigest: regionSeal.preparedReceptorDigest, coordinateStateDigest: regionSeal.coordinateStateDigest, coordinateFrame: regionSeal.coordinateFrame,
  geometryType: regionSeal.geometryType, min: regionSeal.min, max: regionSeal.max, center: regionSeal.center, fullExtents: regionSeal.fullExtents,
  units: regionSeal.units, boundary: regionSeal.boundary, posePolicy: regionSeal.posePolicy, derivationMode: regionSeal.derivationMode,
  paddingAngstrom: regionSeal.paddingAngstrom, fixedAcrossLigandStates: regionSeal.fixedAcrossLigandStates, referenceOccurrenceRef: null };
checkDigest("searchRegion", "D2_SEARCH_REGION", "D2_SEARCH_REGION_V1", searchRegionPayload, regionSeal.digest);
await outJson("D2_SEAL_DIGEST_REPLAY_VALIDATION.json", { status: "PASS", validator: "independent canonical-CBOR digest recomputation for source-built D2 graph, identity, chemical and coordinate states, D2 prepared states, kinematic model, and SearchRegion", checks: digestChecks });
const searchRegionExtent = regionMax.map((v, i) => v - regionMin[i]!);
const gridCells = searchRegionExtent.map((extent) => Math.ceil((extent + 2 * 0.375) / 0.375));
const fieldPointCounts = gridCells.map((cells) => cells + 1);
const searchRegionGeometry = { minimum: regionMin, maximum: regionMax, extent: searchRegionExtent,
  gridProfileId: "ME_VINA_GRID_V1_1_0", spacingAngstrom: 0.375, interpolationHaloAngstrom: 0.375,
  fieldOrigin: regionMin.map((v) => v - 0.375), fieldDomainMaximum: regionMin.map((v, i) => v - 0.375 + gridCells[i]! * 0.375), gridCells, pointCounts: fieldPointCounts,
  totalGridPoints: fieldPointCounts.reduce((product, count) => product * count, 1),
  pairCutoffAngstrom: 8.0, receptorInfluenceSupportRadiusAngstrom: 8.0 + Math.sqrt(3) * 0.375,
  receptorInfluenceMinimum: regionMin.map((v) => v - (8.0 + Math.sqrt(3) * 0.375)), receptorInfluenceMaximum: regionMax.map((v) => v + (8.0 + Math.sqrt(3) * 0.375)) };
must(searchRegionGeometry.extent.every((v) => v <= 40) && fieldPointCounts.every((v) => v <= 110) && searchRegionGeometry.totalGridPoints <= 110 ** 3,
  "cohort envelope exceeds the sealed SearchRegion or field-axis/point resource limits");
const poseCohort = { schemaId: "D3_CLOSURE_FULLPOSE_COHORT_V1", derivation: "exact envelope of the fixed deterministic validation poses; no stochastic search; cutoff stress places one source-backed atom pair at the scorer's exact 8.0 Å cutoff", pairCutoffAngstrom: 8.0,
  crystalReference: "3DMX model 1 / label_asym_id G / comp_id BNZ / C1-C6", cutoffStress: { poseId: "cutoff-exact-8A", nominatedPair: { receptorAtomUid: nearest.receptorAtomUid, ligandAtomUid: nearest.ligandAtomUid, crystalDistanceAngstrom: nearest.distance, transformedDistanceAngstrom: cutoffDistanceAfter }, translationAngstrom: cutoffTranslation },
  searchRegionDigest: regionSeal.digest, searchRegionGeometry, poses: poseSpecs };

const writeState = async (name: string, value: unknown) => outJson(`sealed_states/${name}.json`, value);
await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(root, "sealed_states"), { recursive: true }));
await writeState("prepared_receptor", receptorSeal);
await writeState("prepared_ligand", ligandSeal);
await writeState("search_region", regionSeal);
await outJson("VALIDATION_POSE_COHORT.json", poseCohort);

await outJson("D2_SEALED_STATE_SUMMARY.json", {
  schemaId: "D3_CLOSURE_D2_SEALED_STATE_SUMMARY_V1", status: "PASS", preparedReceptorDigest: receptorSeal.digest, preparedLigandDigest: ligandSeal.digest,
  receptorCoordinateStateDigest: receptorSeal.coordinateState.digest, ligandCoordinateStateDigest: ligandSeal.coordinateState.digest,
  searchRegionDigest: regionSeal.digest, receptorAtomCount: receptorSeal.graphRevision.atoms.length, receptorHeavyAtomCount: receptorSeal.graphRevision.atoms.filter((a: any) => a.element !== "H").length,
  receptorHydrogenCount: receptorSeal.graphRevision.atoms.filter((a: any) => a.element === "H").length, receptorResidueCount: receptorSeal.graphRevision.components.length,
  ligandAtomCount: ligandSeal.graphRevision.atoms.length, ligandHeavyAtomCount: ligandSeal.graphRevision.atoms.filter((a: any) => a.element !== "H").length,
  ligandHydrogenCount: ligandSeal.graphRevision.atoms.filter((a: any) => a.element === "H").length, ligandSearchTorsionCount: ligandSeal.kinematicModel.searchTorsionCount,
  searchRegion: { min: regionMin, max: regionMax, paddingAngstrom: [0,0,0], dimensionsAngstrom: regionMax.map((v, i) => v - regionMin[i]!), volumeAngstrom3: regionMax.reduce((p, v, i) => p * (v - regionMin[i]!), 1), grid: searchRegionGeometry },
  sourceArtifactSha256: sourceSha, profileId: profileConfig.profile_id, altlocSelections: selectedAltlocs,
  typeCounts: Object.fromEntries([...new Set(receptorTypeRows.map((x) => x.typeId))].map((typeId) => [typeId, receptorTypeRows.filter((x) => x.typeId === typeId).length])),
  poseCount: poseSpecs.length, cutoffStressPairDistanceAngstrom: cutoffDistanceAfter,
});

const byteSha = async (relativePath: string) => createHash("sha256").update(await readFile(path.resolve(relativePath))).digest("hex");
const profileSourcePaths = {
  scoring: ["native/docking-reference/scoring/include/mole/docking/scoring.hpp", "native/docking-reference/scoring/src/scoring.cpp"],
  typing: ["native/docking-reference/scoring/include/mole/docking/scoring.hpp", "native/docking-reference/scoring/src/scoring.cpp", "verification/d3-closure-exec-01/tools/seal_3dmx_bnz_states.ts"],
  chemistry: ["verification/d3-prep-auth-04/CHEMICAL_STATE_DECISION.md", "verification/d3-closure-exec-01/CORRECTED_PREPARATION_PROFILE.md", "verification/d3-closure-exec-01/SOURCE_PROFILE_COMPLETENESS_MATRIX.csv", "verification/d3-closure-exec-01/tools/seal_3dmx_bnz_states.ts"],
  numericalBackend: ["native/docking-reference/scoring/src/scoring.cpp", "native/docking-reference/scoring/src/scoring_field.cpp", "verification/d3-closure-exec-01/tools/full_pose_compare.cpp"],
  scorerTorsion: ["apps/api/src/docking/d3VinaTorsion.ts", "native/docking-reference/scoring/include/mole/docking/scoring.hpp"],
};
const sourceRefsFor = async (paths: string[]) => Promise.all(paths.map(async (repoPath) => ({ path: repoPath.replaceAll("\\", "/"), sha256: await byteSha(repoPath) })));
const profileArtifact = (profileId: string, semanticVersion: string, definition: unknown, sourceArtifacts: unknown[], dependencyProfileDigests: string[] = []) => {
  const payload = { schemaVersion: 1, semanticSchemaId: "D3_CLOSURE_PROFILE_ARTIFACT_V1", profileId, semanticVersion, dependencyProfileDigests, sourceArtifacts, definition };
  return { ...payload, digest: scientificDigest<any>("D3_CLOSURE_PROFILE_MANIFEST", "D3_CLOSURE_PROFILE_ARTIFACT_V1", payload) };
};
await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(path.join(root, "profiles"), { recursive: true }), mkdir(path.join(root, "typing"), { recursive: true })]));
const chemistryDefinition = {
  preparationProfileId: profileConfig.profile_id, targetPHF64Bits: f64Bits(profileConfig.target_pH), context: profileConfig.context,
  chemicalStateAssignments: profileConfig.chemical_state_assignments, termini: profileConfig.termini,
  atomFeatureRules: [
    "Protein backbone N is donor except PRO N; backbone carbonyl O and terminal OXT are acceptors.",
    "ASN ND2 donor / OD1 acceptor; GLN NE2 donor / OE1 acceptor.",
    "ASP OD1+OD2 and GLU OE1+OE2 acceptors under the explicitly owner-approved deprotonated state.",
    "ARG NE+NH1+NH2 and LYS NZ donors under the explicitly owner-approved protonated state.",
    "HIS31 neutral HID: ND1 donor, NE2 acceptor; TYR OH, SER OG, THR OG1 donor and acceptor; TRP NE1 donor.",
    "C atoms are C_P only when directly bonded to a non-carbon/non-hydrogen atom; otherwise C_H. Other atom roles come from explicit residue/CCD chemistry, never imported partial charge."
  ],
  sourceChemistryInterpretation: "AUTH04-approved one-fixture chemical-state hypothesis; pH 6.9 is a crystallization-context proxy, not an experimentally established binding pH or pKa prediction.",
};
const chemistryDoc = profileArtifact("ME_SUPPORTED_CHEMISTRY_V1_1_0", "1.1.0", chemistryDefinition, await sourceRefsFor(profileSourcePaths.chemistry));
const typingDefinition = { closedXsVocabulary: ["C_H","C_P","N_P","N_D","N_A","N_DA","O_P","O_D","O_A","O_DA","S_P","P_P","F_H","Cl_H","Br_H","I_H"],
  elementRoleRule: "Use only explicit element, bonded-to-heteroatom, donor, and acceptor features; no element-only or partial-charge fallback.",
  featureProfile: chemistryDoc.digest, hydrogens: "Explicit in sealed state; excluded from receptor-ligand heavy-atom scoring projection." };
const typingDoc = profileArtifact("ME_XS_TYPING_V1_1_0", "1.1.0", typingDefinition, await sourceRefsFor(profileSourcePaths.typing), [chemistryDoc.digest]);
const scoringDoc = profileArtifact("ME_DOCKING_V1_VINA_CLASSIC_1_0", "1.0.0", { weightedTermOrder: ["Gaussian1","Gaussian2","Repulsion","Hydrophobic","HydrogenBond"],
  coefficientF64Bits: [-0.035579,-0.005156,0.840245,-0.035069,-0.587439].map((value) => f64Bits(value)), pairCutoffAngstromF64Bits: f64Bits(8.0), torsionDivisorCoefficientF64Bits: f64Bits(0.05846), electrostatics: false, importedPartialChargeUse: false }, await sourceRefsFor(profileSourcePaths.scoring), [typingDoc.digest]);
const backendDoc = profileArtifact("ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0", "1.0.0", { execution: "CPU reference double-precision direct scorer and deterministic serial scoring-field builder/interpolator", canonicalAtomOrder: "stable AtomUID lexical order", gridInterpolation: "trilinear; fail closed for out-of-domain or missing channel; no clamp or extrapolation" }, await sourceRefsFor(profileSourcePaths.numericalBackend));
const torsionDoc = { ...D3_VINA_TORSION_PROFILE_V1, digest: D3_VINA_TORSION_PROFILE_DIGEST };
const profileDocs = { scoring: scoringDoc, typing: typingDoc, chemistry: chemistryDoc, numericalBackend: backendDoc, scorerTorsion: torsionDoc };
for (const [name, doc] of Object.entries(profileDocs)) await outJson(`profiles/${name}.json`, doc);

const assignmentDoc = (profileId: string, assignments: any[]) => {
  const sorted = [...assignments].sort((a, b) => a.atomUid.localeCompare(b.atomUid));
  const payload = { schemaVersion: 1, semanticSchemaId: "D3_XS_TYPING_ASSIGNMENT_V1", profileId, assignments: sorted };
  return { ...payload, digest: scientificDigest<any>("D3_XS_TYPING_ASSIGNMENT", "D3_XS_TYPING_ASSIGNMENT_V1", payload) };
};
const receptorAssignmentDoc = assignmentDoc("ME_XS_TYPING_V1_1_0", receptorTypeRows);
const ligandAssignmentDoc = assignmentDoc("ME_XS_TYPING_V1_1_0", ligandTypeRows);
await outJson("typing/receptor-assignment.json", receptorAssignmentDoc);
await outJson("typing/ligand-assignment.json", ligandAssignmentDoc);

const sealedInputs = JSON.parse(await readFile(path.join(root, "SEALED_PREPARATION_RUN_INPUTS.json"), "utf8"));
const completenessValidation = JSON.parse(await readFile(path.join(root, "PROFILE_COMPLETENESS_VALIDATION.json"), "utf8"));
must(completenessValidation.status === "PASS" && completenessValidation.selected_receptor_heavy_atom_count === 1306 && completenessValidation.state_sensitive_site_count === 51,
  "profile completeness evidence must PASS before D2 state serialization");
const sourceManifestSha = shaRef(sealedInputs.source_manifest_sha256);
const prepProfilePayload = {
  schemaVersion: 1, semanticSchemaId: "D3_3DMX_BNZ_PREPARATION_PROFILE_V1", profileId: profileConfig.profile_id, semanticVersion: profileConfig.semantic_version,
  predecessorProfileId: profileConfig.predecessor_profile_id, sourceManifestDigest: sourceManifestSha,
  selectedSourceDigests: { "3DMX.cif": shaRef(sourceSha), "BNZ.cif": shaRef(prepared.graph_state.source_hashes["BNZ.cif"].sha256) },
  correctedAltlocGroups: profileConfig.altloc_resolution.groups.map((group: any) => ({ labelSeqId: group.label_seq_id, residueName: group.residue_name, selectedLabel: group.selected_label,
    occupancies: Object.fromEntries(Object.entries(group.occupancy_by_label).map(([label, occupancy]) => [label, Number(occupancy).toFixed(2)])) })),
  chemicalStateAssignments: profileConfig.chemical_state_assignments, termini: profileConfig.termini,
  componentPolicy: profileConfig.component_policy, componentDispositionCounts: profileConfig.component_disposition_counts,
  hydrogenMethod: profileConfig.hydrogen_method, heavyAtomInvariant: { zeroAdditions: profileConfig.heavy_atom_invariant.zero_additions, zeroDeletions: profileConfig.heavy_atom_invariant.zero_deletions,
    zeroRemappings: profileConfig.heavy_atom_invariant.zero_remappings, bitwiseInMemoryCoordinateIdentity: profileConfig.heavy_atom_invariant.bitwise_in_memory_coordinate_identity,
    serializationRoundtripToleranceAngstromF64Bits: f64Bits(profileConfig.heavy_atom_invariant.serialization_roundtrip_tolerance_angstrom) },
  sealedDriverSha256: shaRef(sealedInputs.driver_sha256), parserSha256: shaRef(sealedInputs.cif_parser_sha256), profileConfigSha256: shaRef(sealedInputs.profile_config_sha256),
  completenessMatrixSha256: shaRef(sealedInputs.completeness_matrix_sha256), completenessValidationSha256: shaRef(sealedInputs.profile_completeness_validation_sha256),
  runtime: { python: sealedInputs.python_version ?? profileConfig.python_version, rdkit: profileConfig.rdkit_version, executionPlatform: "Linux x86-64, Ubuntu 24.04.5 under WSL2", preparationCommand: "tools/prepare_3dmx_bnz_hydrogens.py; run-1 and run-2" },
};
const prepProfileDoc = { ...prepProfilePayload, digest: scientificDigest<any>("D3_PREPARATION_PROFILE_MANIFEST", "D3_3DMX_BNZ_PREPARATION_PROFILE_V1", prepProfilePayload) };
await outJson("profiles/preparation-profile-v1.1.json", prepProfileDoc);
const heavyInvariantBytes = await readFile(path.join(root, "prepared_states/run-1/HEAVY_ATOM_INVARIANTS.json"));
const hydrogenProvenanceBytes = await readFile(path.join(root, "prepared_states/run-1/HYDROGEN_PROVENANCE.json"));
const activityPayload = { schemaVersion: 1, semanticSchemaId: "D3_PREPARATION_ACTIVITY_V1", profileDigest: prepProfileDoc.digest,
  run1PayloadSha256: shaRef((await readFile(path.join(root, "prepared_states/run-1/PREPARED_SCIENTIFIC_PAYLOAD.sha256"), "utf8")).trim()),
  run2PayloadSha256: shaRef((await readFile(path.join(root, "prepared_states/run-2/PREPARED_SCIENTIFIC_PAYLOAD.sha256"), "utf8")).trim()),
  heavyInvariantByteDigest: shaRef(createHash("sha256").update(heavyInvariantBytes).digest("hex")), hydrogenProvenanceByteDigest: shaRef(createHash("sha256").update(hydrogenProvenanceBytes).digest("hex")),
  runtimeIdentityDigest: shaRef(await byteSha("verification/d3-closure-exec-01/runtime_logs/linux/runtime-identity.json")), replayValidationDigest: shaRef(await byteSha("verification/d3-closure-exec-01/PREPARATION_REPLAY_VALIDATION.json")) };
const activityDigest = scientificDigest<any>("D3_PREPARATION_ACTIVITY", "D3_PREPARATION_ACTIVITY_V1", activityPayload);
const envelope = (kind: "receptor" | "ligand") => {
  const state = kind === "receptor" ? receptorSeal : ligandSeal;
  const payload: any = { schemaVersion: 1, semanticSchemaId: kind === "receptor" ? "D3_PROFILE_AWARE_PREPARED_RECEPTOR_V1" : "D3_PROFILE_AWARE_PREPARED_LIGAND_V1",
    d2PreparedStateDigest: state.digest, d2ConsumerProfileId: state.profileId, preparationProfileId: prepProfileDoc.profileId, preparationProfileDigest: prepProfileDoc.digest,
    sourceInputManifestDigest: sourceManifestSha, preparationActivityToolchainDigest: activityDigest,
    heavyAtomInvariantDigest: shaRef(createHash("sha256").update(heavyInvariantBytes).digest("hex")),
    generatedHydrogenProvenanceDigest: shaRef(createHash("sha256").update(hydrogenProvenanceBytes).digest("hex")),
    sourceInputDigests: [shaRef(sourceSha), shaRef(prepared.graph_state.source_hashes["BNZ.cif"].sha256)] };
  if (kind === "ligand") payload.ligandGraphIdentity = { selectedComponentId: ligandSeal.selectedComponentId, heavyAtomIds: ligandSeal.graphRevision.atoms.filter((a: any) => a.element !== "H").map((a: any) => a.atomUid).sort(),
    torsionEvidenceDigest: torsionImport.value!.scorerTorsionAssignment.digest, scorerTorsionProfileDigest: torsionImport.value!.scorerTorsionAssignment.profileDigest };
  return { ...payload, digest: scientificDigest<any>("D3_PROFILE_AWARE_PREPARED_STATE", payload.semanticSchemaId, payload) };
};
const stateEnvelopes = { schemaId: "D3_PROFILE_AWARE_PREPARED_STATE_ENVELOPES_V1", preparationProfile: prepProfileDoc,
  preparationActivityToolchainDigest: activityDigest, preparedReceptor: envelope("receptor"), preparedLigand: envelope("ligand") };
await outJson("D3_PROFILE_AWARE_PREPARED_STATE_ENVELOPES.json", stateEnvelopes);

const artifactRef = async (relativePath: string) => ({ path: `../${relativePath.replaceAll("\\", "/")}`, sha256: await byteSha(path.join(root, relativePath)) });
const scoringAssignmentsByUid = new Map(receptorTypeRows.map((row) => [row.atomUid, row.typeId]));
const ligandAssignmentsByUid = new Map(ligandTypeRows.map((row) => [row.atomUid, row.typeId]));
const atomProjection = (state: any, assignments: Map<string, string>) => state.graphRevision.atoms.filter((atom: any) => atom.element !== "H").map((atom: any) => {
  const coordinate = state.coordinateState.coordinates[atom.atomUid].map((value: any) => f64Value(value));
  return { atomUid: atom.atomUid, xsType: assignments.get(atom.atomUid), element: atom.element, positionAngstrom: coordinate,
    formalCharge: state.chemicalState.formalCharges[atom.atomUid], importedPartialCharge: null, scoringCenter: true };
}).sort((a: any, b: any) => a.atomUid.localeCompare(b.atomUid));
const scoringProjectionReceptor = atomProjection(receptorSeal, scoringAssignmentsByUid);
const scoringProjectionLigand = atomProjection(ligandSeal, ligandAssignmentsByUid);
const fullposeDir = path.join(root, "fullpose");
await import("node:fs/promises").then(({ mkdir }) => mkdir(fullposeDir, { recursive: true }));
const fullposeBundle: any = {
  schemaId: "MOLE_D3_FULLPOSE_INPUT_V1", mode: "SEALED_STATES", coordinateUnits: "ANGSTROM", siteClass: "DRY_CORE", siteInfluenceComplete: true,
  states: { preparedReceptorDigest: receptorSeal.digest, preparedLigandDigest: ligandSeal.digest,
    preparedReceptorCoordinateStateDigest: receptorSeal.coordinateState.digest, preparedLigandCoordinateStateDigest: ligandSeal.coordinateState.digest },
  coordinateStateDigest: ligandSeal.coordinateState.digest, searchRegionDigest: regionSeal.digest,
  searchRegion: { minimum: regionMin, maximum: regionMax, boundary: regionSeal.boundary, preparedReceptorDigest: receptorSeal.digest, coordinateStateDigest: receptorSeal.coordinateState.digest, digest: regionSeal.digest },
  stateArtifacts: { preparedReceptor: await artifactRef("sealed_states/prepared_receptor.json"), preparedLigand: await artifactRef("sealed_states/prepared_ligand.json") },
  searchRegionArtifact: await artifactRef("sealed_states/search_region.json"),
  profiles: { receptor_profile_id: D2_RECEPTOR_PROFILE_ID, scoring_profile_id: scoringDoc.profileId, receptor_typing_profile_id: typingDoc.profileId, ligand_typing_profile_id: typingDoc.profileId,
    chemistry_profile_id: chemistryDoc.profileId, numerical_backend_profile_id: backendDoc.profileId, scorer_torsion_profile_id: torsionImport.value!.scorerTorsionAssignment.profileId,
    scoring_profile_digest: scoringDoc.digest, typing_profile_digest: typingDoc.digest, chemistry_profile_digest: chemistryDoc.digest, numerical_backend_profile_digest: backendDoc.digest,
    receptor_typing_assignment_digest: receptorAssignmentDoc.digest, ligand_typing_assignment_digest: ligandAssignmentDoc.digest,
    scorer_torsion_profile_digest: torsionImport.value!.scorerTorsionAssignment.profileDigest, scorer_torsion_assignment_digest: torsionImport.value!.scorerTorsionAssignment.digest },
  profileArtifacts: { scoring: await artifactRef("profiles/scoring.json"), typing: await artifactRef("profiles/typing.json"), chemistry: await artifactRef("profiles/chemistry.json"),
    numericalBackend: await artifactRef("profiles/numericalBackend.json"), scorerTorsion: await artifactRef("profiles/scorerTorsion.json") },
  typingAssignmentArtifacts: { receptor: await artifactRef("typing/receptor-assignment.json"), ligand: await artifactRef("typing/ligand-assignment.json") },
  scorerTorsionAssignmentArtifact: await artifactRef("torsion/D3_VINA_SCORER_TORSION_ASSIGNMENT.json"),
  torsions: { searchTorsionCount: ligandSeal.kinematicModel.searchTorsionCount, nTorsVina: f64Value(torsionImport.value!.scorerTorsionAssignment.nTorsVina) },
  receptorAtoms: scoringProjectionReceptor, ligandAtoms: scoringProjectionLigand,
  poses: poseSpecs.map((pose) => ({ poseId: pose.poseId, cohortClass: pose.cohortClass, cutoffStress: pose.cutoffStress,
    transform: { translationAngstrom: pose.translationAngstrom, rotationAxis: pose.rotationAxis, rotationAngleRadians: pose.rotationAngleRadians, rotationOriginAngstrom: pose.rotationOriginAngstrom } })),
  profileAwarePreparedStateEnvelopes: { receptorDigest: stateEnvelopes.preparedReceptor.digest, ligandDigest: stateEnvelopes.preparedLigand.digest },
};
await writeFile(path.join(fullposeDir, "3dmx-bnz-fullpose-input.json"), `${JSON.stringify(fullposeBundle, null, 2)}\n`, "utf8");
await outJson("FULLPOSE_PROFILE_DIGESTS.json", { preparationProfileDigest: prepProfileDoc.digest, preparationActivityToolchainDigest: activityDigest,
  scoringProfileDigest: scoringDoc.digest, typingProfileDigest: typingDoc.digest, chemistryProfileDigest: chemistryDoc.digest, numericalBackendProfileDigest: backendDoc.digest,
  scorerTorsionProfileDigest: torsionImport.value!.scorerTorsionAssignment.profileDigest, receptorTypingAssignmentDigest: receptorAssignmentDoc.digest,
  ligandTypingAssignmentDigest: ligandAssignmentDoc.digest, scorerTorsionAssignmentDigest: torsionImport.value!.scorerTorsionAssignment.digest,
  receptorEnvelopeDigest: stateEnvelopes.preparedReceptor.digest, ligandEnvelopeDigest: stateEnvelopes.preparedLigand.digest });
console.log(JSON.stringify({ status: "PASS", receptorDigest: receptorSeal.digest, ligandDigest: ligandSeal.digest, searchRegionDigest: regionSeal.digest, receptorAtomCount: receptorSeal.graphRevision.atoms.length, ligandAtomCount: ligandSeal.graphRevision.atoms.length }));
