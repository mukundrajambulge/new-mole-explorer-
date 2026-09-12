import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MAX_STRUCTURE_BYTES, StructureIngestionService } from "./ingestion.js";

const pdbFixture = `HEADER    TEST\nATOM      1  CA  ALA A   1       1.000   2.000   3.000  1.00 20.00           C\nHETATM    2  C1  LIG A 101       4.000   5.000   6.000  1.00 20.00           C\nHETATM    3  O   HOH A 201       7.000   8.000   9.000  1.00 20.00           O\nEND\n`;

const cifFixture = `data_test\nloop_\n_atom_site.group_PDB\n_atom_site.id\n_atom_site.type_symbol\n_atom_site.label_atom_id\n_atom_site.label_comp_id\n_atom_site.label_asym_id\n_atom_site.label_seq_id\n_atom_site.Cartn_x\n_atom_site.Cartn_y\n_atom_site.Cartn_z\nATOM 1 C CA ALA A 1 1.0 2.0 3.0\nHETATM 2 O O HOH A 2 4.0 5.0 6.0\n`;

const pqrFixture = `ATOM      1  N   ALA A   1      -1.100   2.000   3.000 -0.3000 1.5500
ATOM      2  CA  ALA A   1       0.000   2.000   3.000  0.1000 1.7000
HETATM    3  O   HOH A   2       1.000   2.000   3.000 -0.8000 1.5200
`;

const partialChargeCifFixture = `data_charges
loop_
_chem_comp_atom.comp_id
_chem_comp_atom.atom_id
_chem_comp_atom.partial_charge
ALA CA 0.25
LIG C1 -0.50
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
ATOM 1 C CA ALA A 1 1.0 2.0 3.0
HETATM 2 C C1 LIG A 101 4.0 5.0 6.0
`;

const typedNucleicCifFixture = `data_typed\nloop_\n_entity_poly.entity_id\n_entity_poly.type\n1 polyribonucleotide\n2 polypeptide(L)\nloop_\n_atom_site.group_PDB\n_atom_site.id\n_atom_site.type_symbol\n_atom_site.label_atom_id\n_atom_site.label_comp_id\n_atom_site.label_asym_id\n_atom_site.label_seq_id\n_atom_site.label_entity_id\n_atom_site.Cartn_x\n_atom_site.Cartn_y\n_atom_site.Cartn_z\nATOM 1 P P A A 1 1 0.0 0.0 0.0\nATOM 2 C C4 A A 1 1 1.0 0.0 0.0\nATOM 3 C CA ALA B 1 2 2.0 0.0 0.0\nATOM 4 N N ALA B 1 2 3.0 0.0 0.0\n`;

const edgeIdentityCifFixture = `data_edge\nloop_\n_atom_site.group_PDB\n_atom_site.id\n_atom_site.type_symbol\n_atom_site.label_atom_id\n_atom_site.label_comp_id\n_atom_site.label_asym_id\n_atom_site.label_seq_id\n_atom_site.label_alt_id\n_atom_site.pdbx_PDB_segment_id\n_atom_site.Cartn_x\n_atom_site.Cartn_y\n_atom_site.Cartn_z\n_atom_site.occupancy\n_atom_site.B_iso_or_equiv\nATOM 1 C CA ALA A 10 A SEG_A 0.0 0.0 0.0 1.00 25.00\nATOM 2 N N ALA A 10 . SEG_A 1.0 0.0 0.0 1.00 10.00\nATOM 3 C CA GLY B 10 . SEG_B 2.0 0.0 0.0 1.00 5.00\nHETATM 4 C C1 LIG B 20 . SEG_L 3.0 0.0 0.0 0.50 30.00\n`;

const fixedPdbLine = (record: "ATOM" | "HETATM", serial: number, atomName: string, residueName: string, chain: string, residueNumber: number, element: string, bFactor: number | undefined, formalCharge: string | undefined) => {
  const fields = Array.from({ length: 80 }, () => " ");
  const put = (start: number, width: number, value: string) => value.slice(0, width).padStart(width, " ").split("").forEach((character, index) => { fields[start + index] = character; });
  const putLeft = (start: number, width: number, value: string) => value.slice(0, width).padEnd(width, " ").split("").forEach((character, index) => { fields[start + index] = character; });
  putLeft(0, 6, record);
  put(6, 5, String(serial));
  putLeft(12, 4, atomName);
  putLeft(17, 3, residueName);
  putLeft(21, 1, chain);
  put(22, 4, String(residueNumber));
  put(30, 8, "1.000");
  put(38, 8, "2.000");
  put(46, 8, "3.000");
  put(54, 6, "1.00");
  if (bFactor !== undefined) put(60, 6, bFactor.toFixed(2));
  putLeft(76, 2, element);
  if (formalCharge) putLeft(78, 2, formalCharge);
  return fields.join("");
};

describe("VIS-01 structure ingestion", () => {
  it("creates canonical metadata and provenance for local PDB input", async () => {
    const result = await new StructureIngestionService().ingestLocal("sample.pdb", Buffer.from(pdbFixture));
    expect(result.structure.source.kind).toBe("LOCAL_FILE");
    expect(result.structure.source.parserProfile).toBe("molecular-workstation-g1b-canonical-v1");
    expect(result.structure.source.sha256).toHaveLength(64);
    expect(result.structure.format).toBe("pdb");
    expect(result.structure.counts).toMatchObject({ atoms: 3, residues: 3, chains: 1, polymerAtoms: 1, ligandAtoms: 1, waterAtoms: 1 });
    expect(result.structure.atoms[0]).toMatchObject({ element: "C", residueName: "ALA", x: 1, y: 2, z: 3, isPolymer: true });
    expect(result.structure.atoms[0].stableId).toContain(":atom:1");
    expect(result.structure.hierarchy.chainIds).toEqual(["chain:A"]);
    expect(result.structure.peptideSequenceDataset).toMatchObject({ profileVersion: "canonical-peptide-sequence-v1", chains: { "chain:A": { sequence: "A" } } });
    expect(result.structure.scientificHash).toHaveLength(64);
    expect(result.renderSource.content).toBe(pdbFixture);
  });

  it("promotes the bounded pinned-PyMOL chemistry role dataset only when canonical topology is available", async () => {
    const result = await new StructureIngestionService().ingestLocal("mini-protein.pdb", readFileSync(new URL("../../../../tests/fixtures/mini-protein.pdb", import.meta.url)));
    const dataset = result.structure.chemistryDataset;
    expect(dataset).toMatchObject({
      profileVersion: "canonical-chemistry-roles-v1",
      provenance: expect.stringContaining("5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69"),
    });
    expect(dataset?.molecularRevision).toBe(result.structure.scientificHash);
    expect(dataset?.donorAtomIds).toHaveLength(7);
    expect(dataset?.acceptorAtomIds).toHaveLength(4);
    expect(dataset?.donorAtomIds.map((id) => result.structure.atoms.find((atom) => atom.stableId === id)?.serial)).toEqual([1, 4, 5, 8, 10, 11, 12]);
    expect(dataset?.acceptorAtomIds.map((id) => result.structure.atoms.find((atom) => atom.stableId === id)?.serial)).toEqual([4, 8, 10, 11]);
  });

  it("fails closed for chemistry roles when a non-solvent atom has no canonical bond topology", async () => {
    const result = await new StructureIngestionService().ingestLocal("sample.pdb", Buffer.from(pdbFixture));
    expect(result.structure.chemistryDataset).toBeUndefined();
  });

  it("parses the admitted mmCIF atom site loop", async () => {
    const result = await new StructureIngestionService().ingestLocal("sample.mmcif", Buffer.from(cifFixture));
    expect(result.structure.format).toBe("mmcif");
    expect(result.structure.counts).toMatchObject({ atoms: 2, polymerAtoms: 1, waterAtoms: 1 });
  });

  it("parses PQR coordinates and preserves complete source-declared charges", async () => {
    const result = await new StructureIngestionService().ingestLocal("charged.pqr", Buffer.from(pqrFixture));
    expect(result.structure.format).toBe("pqr");
    expect(result.structure.counts).toMatchObject({ atoms: 3, polymerAtoms: 2, waterAtoms: 1 });
    expect(result.structure.atoms.map((atom) => [atom.x, atom.y, atom.z])).toEqual([[-1.1, 2, 3], [0, 2, 3], [1, 2, 3]]);
    expect(result.structure.partialChargeDataset).toMatchObject({
      chargeModel: "source-declared PQR atomic charge",
      profileVersion: "pqr-atomic-charge-v1",
      provenance: "Copied from source PQR charge field; no charge inference performed",
    });
    expect(result.structure.partialChargeDataset?.atomChargeMap[result.structure.atoms[0]!.stableId]).toBe(-0.3);
    expect(result.structure.partialChargeDataset?.atomChargeMap[result.structure.atoms[2]!.stableId]).toBe(-0.8);
  });

  it("promotes complete source-declared mmCIF partial charges without inference", async () => {
    const result = await new StructureIngestionService().ingestLocal("charges.mmcif", Buffer.from(partialChargeCifFixture));
    const dataset = result.structure.partialChargeDataset;
    expect(dataset).toMatchObject({
      chargeModel: "source-declared mmCIF _chem_comp_atom.partial_charge",
      profileVersion: "mmcif-chem-comp-partial-charge-v1",
      units: "e",
      provenance: "Copied from source _chem_comp_atom.partial_charge; no charge inference performed",
    });
    expect(dataset?.molecularRevision).toBe(result.structure.scientificHash);
    expect(dataset?.atomChargeMap[result.structure.atoms[0]!.stableId]).toBe(0.25);
    expect(dataset?.atomChargeMap[result.structure.atoms[1]!.stableId]).toBe(-0.5);
  });

  it("does not promote an incomplete source-declared charge map", async () => {
    const incomplete = partialChargeCifFixture.replace("LIG C1 -0.50\n", "");
    const result = await new StructureIngestionService().ingestLocal("incomplete-charges.mmcif", Buffer.from(incomplete));
    expect(result.structure.partialChargeDataset).toBeUndefined();
  });

  it("preserves source-backed polymer entity typing from mmCIF", async () => {
    const result = await new StructureIngestionService().ingestLocal("typed.mmcif", Buffer.from(typedNucleicCifFixture));
    expect(result.structure.polymerTypingSource).toBe("mmCIF _entity_poly.type mapped by _atom_site.label_entity_id");
    expect(result.structure.atoms.map((atom) => atom.polymerType)).toEqual(["NUCLEIC_ACID", "NUCLEIC_ACID", "PROTEIN", "PROTEIN"]);
  });

  it("records canonical one-letter peptide sequences from polymer residue identity", async () => {
    const content = [
      fixedPdbLine("ATOM", 1, "CA", "ALA", "A", 1, "C", 1, undefined),
      fixedPdbLine("ATOM", 2, "CA", "GLY", "A", 2, "C", 2, undefined),
      "END",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("sequence.pdb", Buffer.from(content));
    expect(result.structure.peptideSequenceDataset).toMatchObject({ profileVersion: "canonical-peptide-sequence-v1", chains: { "chain:A": { sequence: "AG" } } });
    expect(result.structure.peptideSequenceDataset?.molecularRevision).toBe(result.structure.scientificHash);
  });

  it("preserves mmCIF segment, alternate-location, occupancy, and B-factor identity fields", async () => {
    const result = await new StructureIngestionService().ingestLocal("edge-identity.mmcif", Buffer.from(edgeIdentityCifFixture));
    expect(result.structure.atoms.map((atom) => atom.segmentId)).toEqual(["SEG_A", "SEG_A", "SEG_B", "SEG_L"]);
    expect(result.structure.atoms[0]).toMatchObject({ altLoc: "A", occupancy: 1, bFactor: 25 });
    expect(result.structure.atoms[3]).toMatchObject({ recordType: "HETATM", occupancy: 0.5, bFactor: 30 });
  });

  it("preserves multi-model mmCIF coordinates as explicit canonical states", async () => {
    const content = `data_states
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA ALA A 1 1.0 2.0 3.0 1
ATOM 1 C CA ALA A 1 4.0 5.0 6.0 2
`;
    const result = await new StructureIngestionService().ingestLocal("states.mmcif", Buffer.from(content));
    expect(result.structure.coordinateStates).toHaveLength(2);
    expect(result.structure.stateOrder).toEqual(result.structure.coordinateStates?.map((state) => state.id));
    expect(result.structure.coordinateStates?.map((state) => state.sourceModelNumber)).toEqual([1, 2]);
    expect(result.structure.coordinateStates?.[1]?.coordinates[result.structure.atoms[0]!.stableId]).toEqual({ x: 4, y: 5, z: 6 });
  });

  it("rejects unadmitted formats without creating a structure", async () => {
    await expect(new StructureIngestionService().ingestLocal("sample.sdf", Buffer.from("not admitted"))).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("fetches mmCIF from the official RCSB download endpoint", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://files.rcsb.org/download/1ABC.cif");
      return new Response(cifFixture, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new StructureIngestionService().ingestRcsb("1abc");
    expect(result.structure.source).toMatchObject({ kind: "RCSB", provider: "RCSB", uri: "https://files.rcsb.org/download/1ABC.cif", originalFilename: "1ABC.cif" });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("falls back to the official wwPDB partner mmCIF endpoint when RCSB is unreachable", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "https://files.rcsb.org/download/1ABC.cif") throw new Error("RCSB edge timeout");
      expect(String(input)).toBe("https://www.ebi.ac.uk/pdbe/entry-files/download/1abc.cif");
      return new Response(cifFixture, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new StructureIngestionService().ingestRcsb("1abc");
    expect(result.structure.source).toMatchObject({ kind: "RCSB", provider: "PDBE", uri: "https://www.ebi.ac.uk/pdbe/entry-files/download/1abc.cif", originalFilename: "1ABC.cif" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("reports not found only when every official remote endpoint returns 404", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new StructureIngestionService().ingestRcsb("1abc")).rejects.toMatchObject({ code: "REMOTE_NOT_FOUND" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("retains explicit PDB CONECT topology without inferring bonds", async () => {
    const content = `ATOM      1  C1  LIG A 101       1.000   2.000   3.000  1.00 20.00           C  \nATOM      2  O1  LIG A 101       2.000   2.000   3.000  1.00 20.00           O  \nCONECT    1    2\nEND\n`;
    const result = await new StructureIngestionService().ingestLocal("bonded.pdb", Buffer.from(content));
    expect(result.structure.bonds).toHaveLength(1);
    expect(result.structure.bonds[0]).toMatchObject({ order: "SINGLE", source: "PDB_CONECT" });
    expect(result.structure.bonds[0].atom1).toBe(result.structure.atoms[0].stableId);
  });

  it("retains source B-factors, formal-charge zero, and unknown formal charge distinctly", async () => {
    const content = [
      fixedPdbLine("ATOM", 1, "CA", "ALA", "A", 1, "C", 12.5, "0+"),
      fixedPdbLine("HETATM", 2, "NA", "NA", "A", 2, "NA", 8, undefined),
      "END",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("properties.pdb", Buffer.from(content));
    expect(result.structure.atoms[0]).toMatchObject({ bFactor: 12.5, formalCharge: 0 });
    expect(result.structure.atoms[1]).toMatchObject({ bFactor: 8 });
    expect(result.structure.atoms[1].formalCharge).toBeUndefined();
  });

  it("preserves source-backed PDB unit-cell parameters", async () => {
    const content = [
      "CRYST1   10.000   10.000   10.000  90.00  90.00  90.00 P 1           1",
      fixedPdbLine("ATOM", 1, "CA", "ALA", "A", 1, "C", 1, undefined),
      "END",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("unit-cell.pdb", Buffer.from(content));
    expect(result.structure.unitCell).toMatchObject({
      a: 10,
      b: 10,
      c: 10,
      alpha: 90,
      beta: 90,
      gamma: 90,
      source: "PDB_CRYST1",
      profileVersion: "fractional-unit-cell-membership-v1",
    });
  });

  it("preserves source-backed mmCIF unit-cell parameters", async () => {
    const content = [
      "data_cell",
      "_cell.length_a 20.0",
      "_cell.length_b 21.0",
      "_cell.length_c 22.0",
      "_cell.angle_alpha 90.0",
      "_cell.angle_beta 91.0",
      "_cell.angle_gamma 89.0",
      "_symmetry.space_group_name_H-M 'P 1'",
      "_cell.Z_PDB 2",
      "loop_",
      "_atom_site.group_PDB",
      "_atom_site.id",
      "_atom_site.type_symbol",
      "_atom_site.label_atom_id",
      "_atom_site.label_comp_id",
      "_atom_site.label_asym_id",
      "_atom_site.label_seq_id",
      "_atom_site.Cartn_x",
      "_atom_site.Cartn_y",
      "_atom_site.Cartn_z",
      "ATOM 1 C CA ALA A 1 1.0 2.0 3.0",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("unit-cell.mmcif", Buffer.from(content));
    expect(result.structure.unitCell).toMatchObject({
      a: 20,
      b: 21,
      c: 22,
      alpha: 90,
      beta: 91,
      gamma: 89,
      spaceGroup: "P 1",
      zValue: 2,
      source: "MMCIF_CELL",
      profileVersion: "fractional-unit-cell-membership-v1",
    });
  });

  it("records admitted PDB HELIX/SHEET assignments as canonical secondary structure", async () => {
    const content = [
      "HELIX    1   1 ALA A   1  GLY A   2  1                                  ",
      "SHEET    1   A 1 THR B   3  SER B   4  0",
      fixedPdbLine("ATOM", 1, "CA", "ALA", "A", 1, "C", 1, undefined),
      fixedPdbLine("ATOM", 2, "CA", "GLY", "A", 2, "C", 2, undefined),
      fixedPdbLine("ATOM", 3, "CA", "THR", "B", 3, "C", 3, undefined),
      fixedPdbLine("ATOM", 4, "CA", "SER", "B", 4, "C", 4, undefined),
      "END",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("secondary.pdb", Buffer.from(content));
    expect(result.structure.secondaryStructureDataset?.assignmentSource).toContain("HELIX/SHEET");
    expect(result.structure.atoms.map((atom) => atom.secondaryStructure)).toEqual(["HELIX", "HELIX", "SHEET", "SHEET"]);
    expect(result.structure.hierarchy.residues["chain:A:residue:1:"]?.secondaryStructure).toBe("HELIX");
  });

  it("preserves multi-model coordinates as explicit canonical states", async () => {
    const content = [
      "MODEL        1",
      "ATOM      1  CA  ALA A   1       1.000   2.000   3.000  1.00 20.00           C",
      "ENDMDL",
      "MODEL        7",
      "ATOM      1  CA  ALA A   1       4.000   5.000   6.000  1.00 20.00           C",
      "ENDMDL",
      "END",
    ].join("\n");
    const result = await new StructureIngestionService().ingestLocal("states.pdb", Buffer.from(content));
    expect(result.structure.coordinateStates).toHaveLength(2);
    expect(result.structure.stateOrder).toEqual(result.structure.coordinateStates?.map((state) => state.id));
    expect(result.structure.coordinateStates?.map((state) => state.sourceModelNumber)).toEqual([1, 7]);
    expect(result.structure.coordinateStates?.[1]?.coordinates[result.structure.atoms[0]!.stableId]).toEqual({ x: 4, y: 5, z: 6 });
  });

  it("enforces the exact upload boundary before parser publication", async () => {
    const service = new StructureIngestionService();
    await expect(service.ingestLocal("under-limit.pdb", Buffer.from(pdbFixture))).resolves.toBeTruthy();
    await expect(service.ingestLocal("at-limit.pdb", Buffer.alloc(MAX_STRUCTURE_BYTES, 0x20))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.ingestLocal("over-limit.pdb", Buffer.concat([Buffer.from(pdbFixture), Buffer.alloc(MAX_STRUCTURE_BYTES)]))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("separates exact acquired bytes from scientific identity", async () => {
    const lf = await new StructureIngestionService().ingestLocal("line-endings.pdb", Buffer.from(pdbFixture));
    const crlf = await new StructureIngestionService().ingestLocal("line-endings.pdb", Buffer.from(pdbFixture.replaceAll("\n", "\r\n")));
    expect(lf.sourceArtifact?.sha256).not.toBe(crlf.sourceArtifact?.sha256);
    expect(lf.sourceArtifact?.byteLength).not.toBe(crlf.sourceArtifact?.byteLength);
    expect(lf.structure.scientificHash).toBe(crlf.structure.scientificHash);
    expect(lf.structure.source.scientificHashProfile).toBe("molexplorer-scientific-canonical-json-v1");
  });

  it("rejects format-policy mismatches before parser publication", async () => {
    await expect(new StructureIngestionService().ingestLocal("wrong.pdb", Buffer.from(cifFixture))).rejects.toMatchObject({ code: "FORMAT_MISMATCH" });
    await expect(new StructureIngestionService().ingestLocal("wrong.xyz", Buffer.from(pdbFixture))).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("acquires remote response bytes through arrayBuffer without text re-encoding", async () => {
    const bytes = Buffer.from(cifFixture.replace("data_test", "data_remote"), "utf8");
    const response = { status: 200, ok: true, headers: new Headers({ "content-type": "chemical/x-mmcif", etag: "r09-test" }), arrayBuffer: async () => bytes, text: () => { throw new Error("remote text path must not be used"); } } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const result = await new StructureIngestionService().ingestRcsb("1abc");
    expect(result.sourceArtifact?.sha256).toBe((await import("../lifecycle/canonicalSerialization.js")).sha256Bytes(bytes));
    expect(result.sourceArtifact?.providerMetadata).toMatchObject({ etag: "r09-test" });
    vi.unstubAllGlobals();
  });

  it("records export-to-source reimport lineage", async () => {
    const result = await new StructureIngestionService().ingestLocal("reimport.pdb", Buffer.from(pdbFixture), { parentExportArtifactId: "export_abc" });
    expect(result.sourceArtifact).toMatchObject({ acquisitionKind: "DERIVED_EXPORT", parentExportArtifactId: "export_abc" });
    expect(result.structure.source.acquisitionKind).toBe("DERIVED_EXPORT");
  });

  it("securely rejects foreign PyMOL session containers without deserialization", async () => {
    await expect(new StructureIngestionService().ingestLocal("foreign.pse", Buffer.from("not pickle"))).rejects.toMatchObject({ code: "SECURITY_REJECTED" });
    await expect(new StructureIngestionService().ingestLocal("foreign.pze", Buffer.from("not pickle"))).rejects.toMatchObject({ code: "SECURITY_REJECTED" });
  });
});
