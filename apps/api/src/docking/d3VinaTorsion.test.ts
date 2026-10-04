import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  D3_VINA_TORSION_PROFILE_ID,
  f64Value,
  type D2AtomUID,
  type D2MolecularGraphRevisionV1,
  type D3VinaAuthoritativeAtomMappingV1,
  type SourceArtifact,
} from "@molecular/contracts";
import { StructureIngestionService } from "../structures/ingestion.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";
import { adaptCanonicalStructure } from "./d2Adapters.js";
import { artifactByteDigest, scientificDigest } from "./scientificSerialization.js";
import {
  D3_VINA_TORSION_PROFILE_DIGEST,
  D3_VINA_TORSION_PROFILE_V1,
  importD3VinaPdbqt,
  sealD3VinaAuthoritativeAtomMapping,
} from "./d3VinaTorsion.js";

type ReferenceCase = {
  case: string;
  input_molecule: string;
  representation_profile: string;
  reference_status: { status: "ACCEPT" | "REJECT"; exit_code: number };
  file: string;
  raw_branch_count: number;
  raw_torsdof?: number;
  source_search_axis_count: number | null;
  source_scorer_ntors: number | null;
  atom_serial_to_input_index?: Record<string, number>;
};

const fixtureRoot = fileURLToPath(new URL("./fixtures/d3-ir-02/", import.meta.url));
const referenceCases = JSON.parse(readFileSync(join(fixtureRoot, "reference_execution_details.json"), "utf8")) as ReferenceCase[];
const ingestion = new StructureIngestionService();
const graphCache = new Map<string, Promise<{ graph: D2MolecularGraphRevisionV1; sourceArtifact: SourceArtifact; indexToUid: Readonly<Record<string, string>> }>>();

const graphFor = (name: string) => {
  const cached = graphCache.get(name);
  if (cached) return cached;
  const pending = (async () => {
    const original = readFileSync(join(fixtureRoot, "sdf", `${name}.sdf`), "utf8");
    // The retained RDKit files begin with an empty title line; the existing
    // bounded SDF reader trims it. Replace only that title line so the counts
    // line remains at the MDL V2000 position. Atom/bond/coordinate rows stay exact.
    const adaptedText = original.replace(/^\r?\n/, "D3-IR-02 fixture header\n");
    const bytes = Buffer.from(adaptedText);
    const loaded = await ingestion.ingestLocal(`${name}.sdf`, bytes);
    if (!loaded.sourceArtifact) throw new Error(`SDF fixture ${name} did not produce SourceArtifact evidence.`);
    const adapted = adaptCanonicalStructure({ structure: loaded.structure, sourceArtifact: loaded.sourceArtifact });
    if (adapted.status !== "VALID" || !adapted.value?.graph) throw new Error(`SDF fixture ${name} did not produce a valid D2 graph: ${JSON.stringify(adapted.diagnostics)}`);
    const indexToUid = Object.fromEntries(Object.entries(adapted.value.correspondence.sourceToCanonical)
      .filter(([key]) => key.startsWith("index:"))
      .map(([key, value]) => [key.slice("index:".length), value]));
    return { graph: adapted.value.graph, sourceArtifact: loaded.sourceArtifact, indexToUid };
  })();
  graphCache.set(name, pending);
  return pending;
};

const pdbqtPathFor = (row: ReferenceCase): string => {
  const directory = row.representation_profile.startsWith("synthetic adversarial")
    ? "adversarial"
    : row.representation_profile.includes("explicit hydrogens retained")
      ? "meeko-explicit-h"
      : "meeko";
  return join(fixtureRoot, directory, row.file);
};

const makeImport = async (row: ReferenceCase, overrideBytes?: Uint8Array) => {
  if (!row.atom_serial_to_input_index) throw new Error(`Reference case ${row.case} has no authoritative mapping (expected for rejected case).`);
  const originalBytes = readFileSync(pdbqtPathFor(row));
  const bytes = overrideBytes ?? originalBytes;
  const { graph, indexToUid } = await graphFor(row.input_molecule);
  const stored = await new SourceArtifactStore().seal({
    acquisitionKind: "LOCAL_UPLOAD",
    originalFilename: `${row.case}.pdbqt`,
    mediaType: "chemical/x-pdbqt",
    format: "pdbqt",
    formatEvidence: [],
    parserProfile: "d3-ir-02-fixture-bytes-v1",
  }, bytes, "2026-09-28T00:00:00.000Z");
  const serialToAtomUid: Record<string, D2AtomUID> = Object.fromEntries(Object.entries(row.atom_serial_to_input_index).map(([serial, inputIndex]) => {
    const uid = indexToUid[String(inputIndex)];
    if (!uid) throw new Error(`Reference case ${row.case} has no canonical AtomUID for SDF input index ${inputIndex}.`);
    return [serial, uid as D2AtomUID];
  }));
  const mapping = sealD3VinaAuthoritativeAtomMapping({
    graph,
    representationArtifactDigest: artifactByteDigest(bytes),
    serialToAtomUid,
    evidenceRefs: [
      `D3-IR-02:reference_execution_details.json#case=${row.case}`,
      `D3-IR-02:inputs/sdf/${row.input_molecule}.sdf`,
    ],
  });
  if (mapping.status !== "VALID" || !mapping.value) throw new Error(`Reference case ${row.case} mapping failed: ${JSON.stringify(mapping.diagnostics)}`);
  const producer = row.representation_profile.startsWith("Meeko v0.8.0")
    ? { status: "KNOWN" as const, name: "Meeko", version: "0.8.0", settingsRefs: [`D3-IR-02:${row.representation_profile}`] }
    : { status: "UNKNOWN" as const, reason: "Synthetic adversarial mutation does not assert the upstream producer.", evidenceRefs: [`D3-IR-02:reference_execution_details.json#case=${row.case}`] };
  const imported = importD3VinaPdbqt({ bytes, sourceArtifact: stored, graph, mapping: mapping.value, producer });
  return { imported, bytes, mapping: mapping.value, graph };
};

const mapped = (value: D3VinaAuthoritativeAtomMappingV1): D3VinaAuthoritativeAtomMappingV1 => value;

describe("D3-TOR-01 Vina v1.2.7 PDBQT torsion representation", () => {
  it("pins a separately versioned scorer-only Vina v1.2.7 profile and semantic digest", () => {
    expect(D3_VINA_TORSION_PROFILE_ID).toBe("ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1");
    expect(D3_VINA_TORSION_PROFILE_V1.source).toEqual({ software: "AutoDock Vina", version: "1.2.7", commit: "8eb40404f4f45608acb3b01427587ac049f27c1" });
    expect(D3_VINA_TORSION_PROFILE_DIGEST).toBe("sha256:0c042369f70f8a555930aa32cf2c0211abf93ef4bc837cdb389caff50e0edc6b");
    const changed = scientificDigest<"ProfileDigest">("D3_VINA_TORSION_PROFILE", "D3_VINA_TORSION_PROFILE_V1", {
      ...D3_VINA_TORSION_PROFILE_V1,
      scorerEndpointRule: "changed scientific rule",
    });
    expect(changed).not.toBe(D3_VINA_TORSION_PROFILE_DIGEST);
  });

  it("reproduces every retained D3-IR-02 accepted case and rejects its malformed control", async () => {
    expect(referenceCases).toHaveLength(23);
    expect(referenceCases.filter((row) => row.reference_status.status === "ACCEPT")).toHaveLength(22);
    expect(referenceCases.filter((row) => row.reference_status.status === "REJECT").map((row) => row.case)).toEqual(["malformed_unclosed_branch"]);
    for (const row of referenceCases) {
      if (row.reference_status.status === "REJECT") {
        const toluene = referenceCases.find((candidate) => candidate.case === "toluene")!;
        const { imported } = await makeImport({ ...row, atom_serial_to_input_index: toluene.atom_serial_to_input_index });
        expect(imported.status, row.case).toBe("INVALID");
        expect(imported.diagnostics.map((diagnostic) => diagnostic.code)).toContain("D3_PDBQT_BRANCH_UNCLOSED");
        continue;
      }
      const { imported } = await makeImport(row);
      expect(imported.status, `${row.case}: ${JSON.stringify(imported.diagnostics)}`).toBe("VALID");
      const value = imported.value!;
      expect(value.sourceEvidence.rawBranches).toHaveLength(row.raw_branch_count);
      expect(value.sourceEvidence.rawTorsdof).toBe(row.raw_torsdof);
      expect(value.searchTopology.activeSearchTorsionCount).toBe(row.source_search_axis_count);
      expect(f64Value(value.scorerTorsionAssignment.nTorsVina)).toBe(row.source_scorer_ntors);
      expect(value.sourceEvidence.mapping.status).toBe("AUTHORITATIVE");
      expect(value.sourceEvidence.representationByteDigest).toBe(value.sourceEvidence.sourceArtifactDigest);
      expect(value.scorerTorsionAssignment.profileId).toBe(D3_VINA_TORSION_PROFILE_ID);
    }
  });

  it("keeps raw TORSDOF, raw branches, active axes, and N_tors independent", async () => {
    const cases = referenceCases.filter((row) => row.case.startsWith("acetamide_resonance_cn_torsdof_"));
    expect(cases.map((row) => row.raw_torsdof)).toEqual([0, 1, 2]);
    for (const row of cases) {
      const { imported } = await makeImport(row);
      expect(imported.status).toBe("VALID");
      expect(imported.value!.sourceEvidence.rawBranches).toHaveLength(1);
      expect(imported.value!.searchTopology.activeSearchTorsionCount).toBe(1);
      expect(f64Value(imported.value!.scorerTorsionAssignment.nTorsVina)).toBe(0.5);
      if (row.raw_torsdof === 1) expect(imported.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("D3_TORSDOF_BRANCH_COUNT_MISMATCH");
      else expect(imported.diagnostics.map((diagnostic) => diagnostic.code)).toContain("D3_TORSDOF_BRANCH_COUNT_MISMATCH");
    }
    const mismatchCases = referenceCases.filter((row) => row.case.startsWith("toluene_terminal_cc_torsdof_"));
    for (const row of mismatchCases) {
      const { imported } = await makeImport(row);
      expect(imported.status).toBe("VALID");
      expect(imported.value!.sourceEvidence.rawTorsdof).toBe(row.raw_torsdof);
      expect(imported.value!.sourceEvidence.rawBranches).toHaveLength(1);
      expect(imported.value!.searchTopology.activeSearchTorsionCount).toBe(0);
      expect(f64Value(imported.value!.scorerTorsionAssignment.nTorsVina)).toBe(0);
    }
  });

  it("matches the required 0, 0.5, 1.0, and 1.5 scorer examples without integer coercion", async () => {
    const expected: Record<string, number> = {
      benzene: 0,
      toluene: 0,
      keepH_toluene: 0.5,
      ethylbenzene: 1,
      keepH_ethylbenzene: 1.5,
      butane: 1,
      keepH_butane: 2,
      acetamide: 0,
      keepH_acetamide: 0.5,
    };
    for (const [caseName, nTors] of Object.entries(expected)) {
      const row = referenceCases.find((candidate) => candidate.case === caseName)!;
      const { imported } = await makeImport(row);
      expect(imported.status, caseName).toBe("VALID");
      expect(f64Value(imported.value!.scorerTorsionAssignment.nTorsVina)).toBe(nTors);
    }
  });

  it("rejects an ambiguous correspondence and missing mapping provenance", async () => {
    const row = referenceCases.find((candidate) => candidate.case === "keepH_toluene")!;
    const { graph, mapping } = await makeImport(row);
    const ambiguous = sealD3VinaAuthoritativeAtomMapping({
      graph,
      representationArtifactDigest: mapping.representationArtifactDigest,
      serialToAtomUid: { "1": Object.values(mapping.serialToAtomUid)[0]!, "2": Object.values(mapping.serialToAtomUid)[0]! },
      evidenceRefs: ["ambiguous test correspondence"],
    });
    expect(ambiguous.status).toBe("AMBIGUOUS");
    const missingEvidence = sealD3VinaAuthoritativeAtomMapping({
      graph,
      representationArtifactDigest: mapping.representationArtifactDigest,
      serialToAtomUid: mapping.serialToAtomUid,
      evidenceRefs: [],
    });
    expect(missingEvidence.status).toBe("AMBIGUOUS");
  });

  it("rejects unsupported atom typing and detects PDBQT byte-digest mismatch", async () => {
    const row = referenceCases.find((candidate) => candidate.case === "benzene")!;
    const bytes = readFileSync(pdbqtPathFor(row));
    const unsupportedText = bytes.toString("utf8").replace(/^ATOM.*$/m, (line) => `${line.slice(0, -1)}X`);
    const unsupported = await makeImport(row, Buffer.from(unsupportedText));
    expect(unsupported.imported.status).toBe("UNSUPPORTED");
    expect(unsupported.imported.diagnostics.map((diagnostic) => diagnostic.code)).toContain("D3_CHEMISTRY_UNSUPPORTED");

    const { graph, mapping } = await makeImport(row);
    const stored = await new SourceArtifactStore().seal({
      acquisitionKind: "LOCAL_UPLOAD", originalFilename: "wrong-digest.pdbqt", mediaType: "chemical/x-pdbqt",
      format: "pdbqt", formatEvidence: [], parserProfile: "d3-test",
    }, bytes, "2026-09-28T00:00:00.000Z");
    const wrongMapping = mapped({ ...mapping, representationArtifactDigest: artifactByteDigest(Buffer.from("different source")) });
    const mismatch = importD3VinaPdbqt({ bytes, sourceArtifact: stored, graph, mapping: wrongMapping, producer: { status: "UNKNOWN", reason: "unknown", evidenceRefs: ["test"] } });
    expect(mismatch.status).toBe("AMBIGUOUS");
  });

  it("rejects malformed characters in the fixed-width atom serial field", async () => {
    const row = referenceCases.find((candidate) => candidate.case === "benzene")!;
    const bytes = readFileSync(pdbqtPathFor(row));
    const malformedText = bytes.toString("utf8").replace(/^(ATOM {2}|HETATM).{5}/m, (record) => `${record.slice(0, 6)}0001X`);
    expect(malformedText).not.toBe(bytes.toString("utf8"));
    const malformed = await makeImport(row, Buffer.from(malformedText));
    expect(malformed.imported.status).toBe("INVALID");
    expect(malformed.imported.diagnostics.map((diagnostic) => diagnostic.code)).toContain("D3_PDBQT_ATOM_SERIAL_INVALID");
  });

  it("keeps scoring results stable when PDBQT root atom record order changes under the same mapping", async () => {
    const row = referenceCases.find((candidate) => candidate.case === "keepH_toluene")!;
    const originalBytes = readFileSync(pdbqtPathFor(row));
    const text = originalBytes.toString("utf8");
    const root = /^ROOT\r?\n([\s\S]*?)^ENDROOT\r?$/m.exec(text);
    expect(root).toBeTruthy();
    const atomLines = root![1]!.split(/\r?\n/).filter((line) => /^(?:ATOM[ \t]{2}|HETATM)/.test(line));
    const reordered = text.replace(root![0], `ROOT\n${[...atomLines].reverse().join("\n")}\nENDROOT`);
    const first = await makeImport(row);
    const second = await makeImport(row, Buffer.from(reordered));
    expect(first.imported.status).toBe("VALID");
    expect(second.imported.status).toBe("VALID");
    expect(f64Value(second.imported.value!.scorerTorsionAssignment.nTorsVina)).toBe(f64Value(first.imported.value!.scorerTorsionAssignment.nTorsVina));
    expect(second.imported.value!.scorerTorsionAssignment.bondAssignments.map((assignment) => [assignment.bondUid, assignment.rotorFlag, f64Value(assignment.totalBondContribution)]))
      .toEqual(first.imported.value!.scorerTorsionAssignment.bondAssignments.map((assignment) => [assignment.bondUid, assignment.rotorFlag, f64Value(assignment.totalBondContribution)]));
  });
});
