import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  D2_KINEMATIC_PROFILE_ID,
  D2_LIGAND_PROFILE_ID,
  D2_RECEPTOR_PROFILE_ID,
  encodeCanonicalCbor,
  f64Bits,
  f64Value,
  preparedReceptorMatchesScoringFieldDependencies,
  sha256Digest,
  type CanonicalMolecularStructure,
  type D2AtomUID,
  type D2ChemicalStateV1,
  type D2CoordinateStateV1,
  type D2PreparedLigandStateV1,
  type D2PreparedReceptorScientificDependenciesV2,
} from "@molecular/contracts";
import { adaptCanonicalStructure, adaptSmilesIdentity, mapPdbqtKinematicEvidence, parsePdbqtKinematicEvidence } from "./d2Adapters.js";
import { assessOrdinaryV1Capability, sealLigandKinematicModel, sealPreparedLigandState, sealPreparedReceptorState, sealSearchRegion, isPoseAdmissibleInSearchRegion } from "./d2Preparation.js";
import { scientificDigest } from "./scientificSerialization.js";
import { D2_D2_GATED_ACCEPTANCE_TEST_IDS, D2_FIXTURE_FAMILIES, D2_IMPLEMENTATION_REQUIREMENT_IDS, D2_LATER_GATE_BOUNDARY_ACCEPTANCE_TEST_IDS, D2_PRODUCTION_ACCEPTANCE_TEST_IDS } from "./d2RequirementMatrix.js";
import { assertD2FixtureCatalog, D2_FIXTURE_CATALOG } from "./d2FixtureCatalog.js";

const sourceSha = "a".repeat(64);
const provenanceDigest = sha256Digest<"ProvenanceRecordDigest">(`sha256:${"b".repeat(64)}`);
const preparedReceptorDependencies = (): D2PreparedReceptorScientificDependenciesV2 => ({
  chemicalPerceptionProfileRef: { profileId: "ME_SUPPORTED_CHEMISTRY_V1_1_0", profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"c".repeat(64)}`) },
  receptorAtomTypingProfileRef: { profileId: "ME_XS_TYPING_V1_1_0", profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"d".repeat(64)}`) },
  scoringProfileRef: { profileId: "ME_DOCKING_V1_VINA_CLASSIC_1_0", profileDigest: sha256Digest<"ScoringProfileDigest">(`sha256:${"e".repeat(64)}`) },
});
const sourceArtifactFor = (format: CanonicalMolecularStructure["format"]) => ({ schemaVersion: 1 as const, sourceArtifactId: "source:d2-fixture", acquisitionKind: "LOCAL_UPLOAD" as const, originalFilename: `d2-fixture.${format}`, mediaType: "chemical/x-fixture", byteLength: 1, sha256: sourceSha, acquiredAt: "2026-09-20T00:00:00.000Z", format, formatEvidence: [], parserProfile: "d2-test" });

const structureFor = (format: CanonicalMolecularStructure["format"] = "sdf", thirdElement = "O"): CanonicalMolecularStructure => ({
  id: "fixture-structure",
  name: "d2-fixture",
  format,
  source: {
    kind: "LOCAL_FILE",
    originalFilename: `d2-fixture.${format}`,
    format,
    sha256: sourceSha,
    byteLength: 1,
    ingestedAt: "2026-09-20T00:00:00.000Z",
    parserProfile: "d2-test",
    sourceArtifactId: "source:d2-fixture",
  },
  counts: { atoms: 3, residues: 1, chains: 1, polymerAtoms: 0, ligandAtoms: 3, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 0 } },
  atoms: [
    { stableId: "source-atom-1", serial: 1, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "source-atom-2", serial: 2, atomName: "N1", element: "N", residueName: "LIG", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "source-atom-3", serial: 3, atomName: "O1", element: thirdElement, residueName: "LIG", residueNumber: 1, chain: "A", x: 2, y: 1, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
  ],
  bonds: [
    { id: "source-bond-1", atom1: "source-atom-1", atom2: "source-atom-2", order: "SINGLE", source: "PDB_CONECT" },
    { id: "source-bond-2", atom1: "source-atom-2", atom2: "source-atom-3", order: "SINGLE", source: "PDB_CONECT" },
  ],
  hierarchy: { chainIds: ["A"], chains: { A: { id: "A", name: "A", residueIds: ["LIG:A:1"] } }, residues: { "LIG:A:1": { id: "LIG:A:1", name: "LIG", number: 1, chainId: "A", atomIds: ["source-atom-1", "source-atom-2", "source-atom-3"], isPolymer: false } } },
  scientificHash: `sha256:${"c".repeat(64)}`,
  coordinateStates: [{ id: "source-state-1", ordinal: 1, sourceModelNumber: 1, coordinates: { "source-atom-1": { x: 0, y: 0, z: 0 }, "source-atom-2": { x: 1, y: 0, z: 0 }, "source-atom-3": { x: 2, y: 1, z: 0 } }, coordinateHash: "state-hash" }],
  stateOrder: ["source-state-1"],
});

const adaptedFixture = (thirdElement = "O") => {
  const result = adaptCanonicalStructure({ structure: structureFor("sdf", thirdElement), sourceArtifact: sourceArtifactFor("sdf") });
  expect(result.status).toBe("VALID");
  expect(result.value).toBeDefined();
  const value = result.value!;
  const identity = value.identity!;
  const graph = value.graph!;
  const selectedComponentId = graph.components[0]!.componentId;
  const formalCharges = Object.fromEntries(graph.atoms.map((atom) => [atom.atomUid, 0])) as Record<D2AtomUID, number | null>;
  const chemicalPayload = { schemaVersion: 1 as const, semanticSchemaId: "D2_CHEMICAL_STATE_V1" as const, molecularIdentityDigest: identity.digest, resolution: "EXPLICIT_SUBMITTED" as const, protonationStatus: "NOT_APPLICABLE" as const, tautomerStatus: "NOT_APPLICABLE" as const, formalCharges, stereo: [], selectedComponentIds: [selectedComponentId], sourceEvidenceRefs: [value.sourceArtifactDigest] };
  const chemicalDigest = scientificDigest<"ChemicalStateDigest">("D2_CHEMICAL_STATE", "D2_CHEMICAL_STATE_V1", chemicalPayload);
  const chemical: D2ChemicalStateV1 = { ...chemicalPayload, stateId: "chemical:fixture", digest: chemicalDigest };
  const sourceCoordinates = value.coordinateStates[0]!;
  const coordinatePayload = { schemaVersion: 1 as const, semanticSchemaId: "D2_COORDINATE_STATE_V1" as const, stateId: "coordinates:fixture", chemicalStateDigest: chemical.digest, coordinateFrame: sourceCoordinates.coordinateFrame, coordinateUnits: "ANGSTROM" as const, dimensionality: 3 as const, origin: [f64Bits(0), f64Bits(0), f64Bits(0)] as const, coordinates: sourceCoordinates.coordinates, sourceArtifactRefs: [value.sourceArtifactDigest] };
  const coordinateDigest = scientificDigest<"CoordinateStateDigest">("D2_COORDINATE_STATE", "D2_COORDINATE_STATE_V1", coordinatePayload);
  const coordinate: D2CoordinateStateV1 = { ...coordinatePayload, digest: coordinateDigest };
  return { ...value, identity, graph, chemical, coordinate, selectedComponentId };
};

const kinematicFor = (fixture: ReturnType<typeof adaptedFixture>) => sealLigandKinematicModel({
  molecularIdentityDigest: fixture.identity.digest,
  graphRevision: fixture.graph,
  rootAtomUid: fixture.graph.atoms[0]!.atomUid,
  fragments: [{ fragmentId: "root", atomUids: [fixture.graph.atoms[0]!.atomUid] }, { fragmentId: "tail", atomUids: fixture.graph.atoms.slice(1).map((atom) => atom.atomUid) }],
  rotatableEdges: [{ bondUid: fixture.graph.bonds[0]!.bondUid, atom1Uid: fixture.graph.bonds[0]!.atom1Uid, atom2Uid: fixture.graph.bonds[0]!.atom2Uid, parentFragmentId: "root", childFragmentId: "tail", movingAtomUids: fixture.graph.atoms.slice(1).map((atom) => atom.atomUid), axisOrigin: [f64Bits(0), f64Bits(0), f64Bits(0)], axisDirection: [f64Bits(1), f64Bits(0), f64Bits(0)], domain: "FULL_TURN", periodicity: 1, terminalHydrogenOnly: false, ringBond: false, restrictedBond: false, searchTorsion: true, scorerTorsion: false, evidenceRefs: ["fixture"] }],
  profileId: D2_KINEMATIC_PROFILE_ID,
});

const sealWithFixture = (fixture: ReturnType<typeof adaptedFixture>) => {
  const kinematic = kinematicFor(fixture);
  return sealPreparedLigandState({ molecularIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: fixture.chemical, coordinateState: fixture.coordinate, selectedComponentId: fixture.selectedComponentId, atomTyping: fixture.graph.atoms.map((atom) => ({ atomUid: atom.atomUid, typeId: `${atom.element}_GENERIC_EXPLICIT`, chargeModel: "FIXTURE_EXPLICIT", evidenceRef: "fixture:typing" })), kinematicModel: kinematic.value!, profileId: D2_LIGAND_PROFILE_ID });
};

describe("D2 halogen ligand from shared native fixture (TS adapter -> elements consumed by the C++ scorer test)", () => {
  const fixtureDir = new URL("../../../../tests/fixtures/", import.meta.url);
  const oracle = Object.fromEntries(readFileSync(new URL("halogen-oracle.txt", fixtureDir), "utf8").trim().split(/\r?\n/).map((l) => { const [k, ...v] = l.split(" "); return [k!, v]; }));
  const pdbqtTypes = readFileSync(new URL("halogen-ligand.pdbqt", fixtureDir), "utf8").split(/\r?\n/).filter((l) => l.startsWith("ATOM")).map((l) => l.trim().split(/\s+/).at(-1)!);
  const mixedCase = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();
  it("adapter emits exactly the element spellings the native oracle test scores", () => {
    const base = structureFor("sdf");
    const coords = readFileSync(new URL("halogen-ligand.pdbqt", fixtureDir), "utf8").split(/\r?\n/).filter((l) => l.startsWith("ATOM")).map((l) => [Number(l.slice(30, 38)), Number(l.slice(38, 46)), Number(l.slice(46, 54))] as const);
    const atoms = pdbqtTypes.map((t, i) => ({ ...base.atoms[0]!, stableId: `source-atom-${i + 1}`, serial: i + 1, atomName: `${t}${i}`, element: mixedCase(t), x: coords[i]![0], y: coords[i]![1], z: coords[i]![2] }));
    const bonds = [1, 2, 3].map((i) => ({ id: `source-bond-${i}`, atom1: "source-atom-1", atom2: `source-atom-${i + 1}`, order: "SINGLE" as const, source: "PDB_CONECT" as const }));
    const result = adaptCanonicalStructure({ structure: { ...base, atoms, bonds }, sourceArtifact: sourceArtifactFor("sdf") });
    expect(result.status).toBe("VALID");
    const elements = result.value!.graph!.atoms.map((a) => a.element);
    expect(elements).toEqual(oracle.ligand_elements);
    expect(elements.every((e) => Number.isFinite(Number(oracle.expected_empirical_score![0])) && e === e.toUpperCase())).toBe(true);
  });
});

describe("D2 halogen element spelling (single route: adapter upper-cases, native scorer is case-insensitive)", () => {
  it.each(["Cl", "CL", "Br", "I"])("seals a ligand containing %s as an upper-case supported element", (el) => {
    const fixture = adaptedFixture(el);
    expect(fixture.graph.atoms[2]!.element).toBe(el.toUpperCase());
    const result = sealWithFixture(fixture);
    expect(result.status).toBe("VALID");
  });
  it("negative control: unknown element yields UNSUPPORTED_LIGAND_ELEMENT", () => {
    const result = sealWithFixture(adaptedFixture("Xx"));
    expect(result.status).not.toBe("VALID");
    expect(JSON.stringify(result.diagnostics)).toContain("UNSUPPORTED_LIGAND_ELEMENT");
  });
});

const preparedLigandFor = (fixture: ReturnType<typeof adaptedFixture>): D2PreparedLigandStateV1 => {
  const kinematic = kinematicFor(fixture);
  expect(kinematic.status).toBe("VALID");
  const result = sealPreparedLigandState({ molecularIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: fixture.chemical, coordinateState: fixture.coordinate, selectedComponentId: fixture.selectedComponentId, atomTyping: fixture.graph.atoms.map((atom) => ({ atomUid: atom.atomUid, typeId: `${atom.element}_GENERIC_EXPLICIT`, chargeModel: "FIXTURE_EXPLICIT", evidenceRef: "fixture:typing" })), kinematicModel: kinematic.value!, profileId: D2_LIGAND_PROFILE_ID });
  expect(result.status).toBe("VALID");
  return result.value!;
};

describe("D2 representation and explicit-state sealing", () => {
  it("pins the complete D2 acceptance ledger without pulling later-gate engines into D2", () => {
    expect(D2_IMPLEMENTATION_REQUIREMENT_IDS).toEqual(["ME-DCK-V1-REQ-0281"]);
    expect(D2_D2_GATED_ACCEPTANCE_TEST_IDS).toHaveLength(84);
    expect(new Set(D2_D2_GATED_ACCEPTANCE_TEST_IDS).size).toBe(84);
    expect(D2_PRODUCTION_ACCEPTANCE_TEST_IDS).toContain("ME-DCK-V1-AT-0281");
    expect(D2_LATER_GATE_BOUNDARY_ACCEPTANCE_TEST_IDS).toContain("ME-DCK-V1-AT-0256");
    expect(D2_FIXTURE_FAMILIES.d2Integration).toEqual(["INT-FX-005", "INT-FX-006", "INT-FX-007", "INT-FX-008", "INT-FX-009", "INT-FX-010"]);
    expect(() => assertD2FixtureCatalog()).not.toThrow();
    expect(D2_FIXTURE_CATALOG.representation).toHaveLength(10);
    expect(D2_FIXTURE_CATALOG.receptor).toHaveLength(30);
    expect(D2_FIXTURE_CATALOG.ligand).toHaveLength(35);
    expect(D2_FIXTURE_CATALOG.site).toHaveLength(30);
  });

  it("adapts a source graph with non-positional AtomUIDs and explicit correspondence", () => {
    const result = adaptCanonicalStructure({ structure: structureFor(), sourceArtifact: sourceArtifactFor("sdf") });
    expect(result.status).toBe("VALID");
    const value = result.value!;
    expect(value.authoritativeForMolecularIdentity).toBe(true);
    expect(value.graph!.atoms).toHaveLength(3);
    expect(value.graph!.atoms[0]!.atomUid).not.toBe("source-atom-1");
    expect(value.correspondence.sourceToCanonical["serial:1"]).toBe(value.graph!.atoms[0]!.atomUid);
    expect(value.chemicalState!.resolution).toBe("UNKNOWN");
  });

  it("rejects canonical structure adaptation without immutable SourceArtifact evidence", () => {
    const result = adaptCanonicalStructure({ structure: structureFor() });
    expect(result.status).toBe("INVALID");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("INVALID_SOURCE_ARTIFACT_EVIDENCE");
    expect(result.value).toBeUndefined();
  });

  it("accepts SMILES only as graph/identity evidence and blocks execution pending explicit 3D", () => {
    const result = adaptSmilesIdentity({ notation: "C[C@H](O)C", sourceArtifact: sourceArtifactFor("sdf") });
    expect(result.status).toBe("VALID");
    expect(result.value).toMatchObject({ graphAuthority: "SMILES_GRAPH_INPUT_ONLY", executionReady: false, requiresExplicitCoordinateState: true });
  });

  it("keeps PDBQT as derived execution evidence and never identity authority", () => {
    const result = adaptCanonicalStructure({ structure: structureFor("pdbqt"), sourceArtifact: sourceArtifactFor("pdbqt") });
    expect(result.status).toBe("VALID");
    expect(result.value!.authoritativeForMolecularIdentity).toBe(false);
    expect(result.value!.identity).toBeUndefined();
    expect(result.value!.executionRepresentation).toMatchObject({ format: "pdbqt", authoritativeForMolecularIdentity: false });
  });

  it("parses and maps PDBQT ROOT/BRANCH/TORSDOF without trusting PDBQT as chemistry", () => {
    const fixture = adaptedFixture();
    const evidence = parsePdbqtKinematicEvidence("ROOT\nHETATM    1  C1  LIG A   1       0.000   0.000   0.000  1.00  0.00    -0.120 C\nENDROOT\nBRANCH 1 2\nENDBRANCH 1 2\nTORSDOF 1\n");
    expect(evidence.status).toBe("VALID");
    expect(evidence.value!.rootAtomSerial).toBe(1);
    const mapped = mapPdbqtKinematicEvidence(evidence.value!, fixture.correspondence, fixture.graph);
    expect(mapped.status).toBe("VALID");
    expect(mapped.value!.branchBondUids).toEqual([fixture.graph.bonds[0]!.bondUid]);
  });

  it("fails closed for generated or ambiguous ligand chemical states", () => {
    const fixture = adaptedFixture();
    const generated = { ...fixture.chemical, resolution: "GENERATED_PROFILE" as const, targetPH: 7, protonationProfileId: "named-profile" };
    const result = sealPreparedLigandState({ molecularIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: generated, coordinateState: fixture.coordinate, selectedComponentId: fixture.selectedComponentId, atomTyping: fixture.graph.atoms.map((atom) => ({ atomUid: atom.atomUid, typeId: "EXPLICIT", chargeModel: "EXPLICIT", evidenceRef: "fixture" })), kinematicModel: kinematicFor(fixture).value!, profileId: D2_LIGAND_PROFILE_ID });
    expect(result.status).toBe("UNSUPPORTED");
    expect(result.value).toBeUndefined();
    const stereo = { ...fixture.chemical, stereo: [{ atomUid: fixture.graph.atoms[0]!.atomUid, status: "UNKNOWN" as const }] };
    const stereoResult = sealPreparedLigandState({ molecularIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: stereo, coordinateState: fixture.coordinate, selectedComponentId: fixture.selectedComponentId, atomTyping: fixture.graph.atoms.map((atom) => ({ atomUid: atom.atomUid, typeId: "EXPLICIT", chargeModel: "EXPLICIT", evidenceRef: "fixture" })), kinematicModel: kinematicFor(fixture).value!, profileId: D2_LIGAND_PROFILE_ID });
    expect(stereoResult.status).toBe("AMBIGUOUS");
    const tautomer = { ...fixture.chemical, tautomerStatus: "AMBIGUOUS" as const };
    const tautomerResult = sealPreparedLigandState({ molecularIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: tautomer, coordinateState: fixture.coordinate, selectedComponentId: fixture.selectedComponentId, atomTyping: fixture.graph.atoms.map((atom) => ({ atomUid: atom.atomUid, typeId: "EXPLICIT", chargeModel: "EXPLICIT", evidenceRef: "fixture" })), kinematicModel: kinematicFor(fixture).value!, profileId: D2_LIGAND_PROFILE_ID });
    expect(tautomerResult.status).toBe("AMBIGUOUS");
  });

  it("seals a ligand state only with one explicit component, finite 3D, typing, and kinematics", () => {
    const fixture = adaptedFixture();
    const ligand = preparedLigandFor(fixture);
    expect(ligand.profileId).toBe(D2_LIGAND_PROFILE_ID);
    expect(ligand.kinematicModel.searchTorsionCount).toBe(1);
    expect(ligand.kinematicModel.scorerTorsionCount).toBe(0);
  });

  it("rejects ring/restricted/terminal-hydrogen rotation and keeps scorer torsions separate", () => {
    const fixture = adaptedFixture();
    const edge = fixture.graph.bonds[0]!;
    const result = sealLigandKinematicModel({ molecularIdentityDigest: fixture.identity.digest, graphRevision: fixture.graph, rootAtomUid: fixture.graph.atoms[0]!.atomUid, fragments: [{ fragmentId: "all", atomUids: fixture.graph.atoms.map((atom) => atom.atomUid) }], rotatableEdges: [{ bondUid: edge.bondUid, atom1Uid: edge.atom1Uid, atom2Uid: edge.atom2Uid, parentFragmentId: "all", childFragmentId: "other", movingAtomUids: [edge.atom2Uid], axisOrigin: [f64Bits(0), f64Bits(0), f64Bits(0)], axisDirection: [f64Bits(1), f64Bits(0), f64Bits(0)], domain: "RESTRICTED_PROFILE", periodicity: 1, terminalHydrogenOnly: true, ringBond: true, restrictedBond: true, searchTorsion: true, scorerTorsion: true, evidenceRefs: ["fixture"] }], profileId: D2_KINEMATIC_PROFILE_ID });
    expect(result.status).toBe("UNSUPPORTED");
  });

  it("seals a closed SearchRegion and excludes a one-ULP-outside heavy atom", () => {
    const fixture = adaptedFixture();
    const ligand = preparedLigandFor(fixture);
    const receptor = sealPreparedReceptorState({ receptorIdentity: fixture.identity, graphRevision: fixture.graph, chemicalState: fixture.chemical, coordinateState: fixture.coordinate, assembly: { selectionKind: "EXPLICIT_ASSEMBLY", assemblyId: "assembly:test", membershipDigest: provenanceDigest }, modelNumber: 1, chainIds: ["A"], altlocResolution: { policy: "PRESERVE_ALL", status: "NOT_APPLICABLE" }, componentRoles: [{ componentId: fixture.selectedComponentId, role: "CORE", evidenceRefs: ["fixture:role"] }], profileId: D2_RECEPTOR_PROFILE_ID, scientificDependencies: preparedReceptorDependencies(), siteCriticalAtomUids: [fixture.graph.atoms[0]!.atomUid] });
    expect(receptor.status).toBe("VALID");
    const region = sealSearchRegion({ bindingSiteRef: "site:test", preparedReceptor: receptor.value!, preparedLigand: ligand, coordinateFrame: fixture.coordinate.coordinateFrame, min: [-1, -1, -1], max: [2, 2, 2], paddingAngstrom: [0, 0, 0], derivationMode: "EXPLICIT_BOUNDS", fixedAcrossLigandStates: true });
    expect(region.status).toBe("VALID");
    expect(isPoseAdmissibleInSearchRegion(region.value!, [[2, 1, 0]])).toBe(true);
    expect(isPoseAdmissibleInSearchRegion(region.value!, [[2 + (2 * Number.EPSILON), 1, 0]])).toBe(false);
    expect(region.value!.fullExtents.map(f64Value)).toEqual([3, 3, 3]);
    // -0 normalisation is an input step at SearchRegion sealing; the encoder itself stays bit-exact.
    const base = { bindingSiteRef: "site:test", preparedReceptor: receptor.value!, preparedLigand: ligand, coordinateFrame: fixture.coordinate.coordinateFrame, max: [2, 2, 2], derivationMode: "EXPLICIT_BOUNDS", fixedAcrossLigandStates: true } as const;
    const zeroBox = sealSearchRegion({ ...base, min: [0, -1, -1], paddingAngstrom: [0, 0, 0] });
    const negZeroBox = sealSearchRegion({ ...base, min: [-0, -1, -1], paddingAngstrom: [-0, 0, 0] });
    expect(negZeroBox.value!.digest).toBe(zeroBox.value!.digest);
    expect(f64Bits(-0)).not.toEqual(f64Bits(0));
  });

  it("ME-DCK-V1-AT-0058 hashes explicit receptor typing/scoring dependency references and rejects mismatches", () => {
    const fixture = adaptedFixture();
    const base = {
      receptorIdentity: fixture.identity,
      graphRevision: fixture.graph,
      chemicalState: fixture.chemical,
      coordinateState: fixture.coordinate,
      assembly: { selectionKind: "EXPLICIT_ASSEMBLY" as const, assemblyId: "assembly:test", membershipDigest: provenanceDigest },
      modelNumber: 1,
      chainIds: ["A"],
      altlocResolution: { policy: "PRESERVE_ALL" as const, status: "NOT_APPLICABLE" as const },
      componentRoles: [{ componentId: fixture.selectedComponentId, role: "CORE" as const, evidenceRefs: ["fixture:role"] }],
      profileId: D2_RECEPTOR_PROFILE_ID,
      siteCriticalAtomUids: [fixture.graph.atoms[0]!.atomUid],
    };
    const dependencies = preparedReceptorDependencies();
    const first = sealPreparedReceptorState({ ...base, scientificDependencies: dependencies });
    const replay = sealPreparedReceptorState({ ...base, scientificDependencies: dependencies });
    const changedChemistry = sealPreparedReceptorState({ ...base, scientificDependencies: { ...dependencies, chemicalPerceptionProfileRef: { ...dependencies.chemicalPerceptionProfileRef, profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"2".repeat(64)}`) } } });
    const changedTyping = sealPreparedReceptorState({ ...base, scientificDependencies: { ...dependencies, receptorAtomTypingProfileRef: { ...dependencies.receptorAtomTypingProfileRef, profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"f".repeat(64)}`) } } });
    const changedScorer = sealPreparedReceptorState({ ...base, scientificDependencies: { ...dependencies, scoringProfileRef: { ...dependencies.scoringProfileRef, profileDigest: sha256Digest<"ScoringProfileDigest">(`sha256:${"1".repeat(64)}`) } } });
    const changedScorerId = sealPreparedReceptorState({ ...base, scientificDependencies: { ...dependencies, scoringProfileRef: { ...dependencies.scoringProfileRef, profileId: "ME_DOCKING_V1_VINA_CLASSIC_1_1" } } });
    expect(first.status).toBe("VALID");
    expect(first.value!.schemaVersion).toBe(2);
    expect(first.value!.semanticSchemaId).toBe("D2_PREPARED_RECEPTOR_STATE_V2");
    expect(replay.value!.digest).toBe(first.value!.digest);
    expect(first.value!.scientificDependencies).toEqual(dependencies);
    const serializedDependencies = new TextDecoder().decode(encodeCanonicalCbor(first.value!.scientificDependencies));
    for (const reference of Object.values(dependencies)) {
      expect(serializedDependencies).toContain(reference.profileId);
      expect(serializedDependencies).toContain(reference.profileDigest);
    }
    expect(changedChemistry.status).toBe("VALID");
    expect(changedChemistry.value!.digest).not.toBe(first.value!.digest);
    expect(changedTyping.status).toBe("VALID");
    expect(changedTyping.value!.digest).not.toBe(first.value!.digest);
    expect(changedScorer.status).toBe("VALID");
    expect(changedScorer.value!.digest).not.toBe(first.value!.digest);
    expect(changedScorerId.status).toBe("VALID");
    expect(changedScorerId.value!.digest).not.toBe(first.value!.digest);
    const matchingFieldDependencies = {
      receptorProfileId: D2_RECEPTOR_PROFILE_ID,
      scoringProfileId: dependencies.scoringProfileRef.profileId,
      scoringProfileDigest: dependencies.scoringProfileRef.profileDigest,
      typingProfileId: dependencies.receptorAtomTypingProfileRef.profileId,
      typingProfileDigest: dependencies.receptorAtomTypingProfileRef.profileDigest,
      chemistryProfileId: dependencies.chemicalPerceptionProfileRef.profileId,
      chemistryProfileDigest: dependencies.chemicalPerceptionProfileRef.profileDigest,
    } as const;
    expect(preparedReceptorMatchesScoringFieldDependencies(first.value!, matchingFieldDependencies)).toBe(true);
    expect(preparedReceptorMatchesScoringFieldDependencies(first.value!, {
      ...matchingFieldDependencies,
      scoringProfileDigest: changedScorer.value!.scientificDependencies.scoringProfileRef.profileDigest,
    })).toBe(false);
    expect(preparedReceptorMatchesScoringFieldDependencies(first.value!, {
      ...matchingFieldDependencies,
      typingProfileDigest: changedTyping.value!.scientificDependencies.receptorAtomTypingProfileRef.profileDigest,
    })).toBe(false);
    expect(preparedReceptorMatchesScoringFieldDependencies(first.value!, {
      ...matchingFieldDependencies,
      chemistryProfileDigest: changedChemistry.value!.scientificDependencies.chemicalPerceptionProfileRef.profileDigest,
    })).toBe(false);
  });

  it("fails closed when a required PreparedReceptorState dependency reference is absent or malformed", () => {
    const fixture = adaptedFixture();
    const base = {
      receptorIdentity: fixture.identity,
      graphRevision: fixture.graph,
      chemicalState: fixture.chemical,
      coordinateState: fixture.coordinate,
      assembly: { selectionKind: "EXPLICIT_ASSEMBLY" as const, assemblyId: "assembly:test", membershipDigest: provenanceDigest },
      modelNumber: 1,
      chainIds: ["A"],
      altlocResolution: { policy: "PRESERVE_ALL" as const, status: "NOT_APPLICABLE" as const },
      componentRoles: [{ componentId: fixture.selectedComponentId, role: "CORE" as const, evidenceRefs: ["fixture:role"] }],
      profileId: D2_RECEPTOR_PROFILE_ID,
      siteCriticalAtomUids: [fixture.graph.atoms[0]!.atomUid],
    };
    const missing = sealPreparedReceptorState({ ...base, scientificDependencies: { ...preparedReceptorDependencies(), scoringProfileRef: undefined } } as never);
    const malformed = sealPreparedReceptorState({ ...base, scientificDependencies: { ...preparedReceptorDependencies(), scoringProfileRef: { profileId: " ", profileDigest: "" } } } as never);
    expect(missing.status).toBe("INVALID");
    expect(missing.value).toBeUndefined();
    expect(missing.diagnostics.map((row) => row.code)).toContain("INVALID_MISSING_PREPARED_RECEPTOR_DEPENDENCY");
    expect(malformed.status).toBe("INVALID");
    expect(malformed.value).toBeUndefined();
    expect(malformed.diagnostics.map((row) => row.code)).toContain("INVALID_PREPARED_RECEPTOR_DEPENDENCY");
  });

  it("keeps ordinary-V1 capability boundaries fail-closed", () => {
    expect(assessOrdinaryV1Capability({}).status).toBe("VALID");
    const unsupported = assessOrdinaryV1Capability({ blindSite: true, flexibleReceptor: true, covalentDocking: true, gpuExecution: true });
    expect(unsupported.status).toBe("UNSUPPORTED");
    expect(unsupported.executable).toBe(false);
    expect(unsupported.reasonCodes).toContain("BLIND_SITE_OUTSIDE_ORDINARY_V1");
  });
});
