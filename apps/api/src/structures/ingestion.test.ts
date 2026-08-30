import { describe, expect, it, vi } from "vitest";
import { StructureIngestionService } from "./ingestion.js";

const pdbFixture = `HEADER    TEST\nATOM      1  CA  ALA A   1       1.000   2.000   3.000  1.00 20.00           C\nHETATM    2  C1  LIG A 101       4.000   5.000   6.000  1.00 20.00           C\nHETATM    3  O   HOH A 201       7.000   8.000   9.000  1.00 20.00           O\nEND\n`;

const cifFixture = `data_test\nloop_\n_atom_site.group_PDB\n_atom_site.id\n_atom_site.type_symbol\n_atom_site.label_atom_id\n_atom_site.label_comp_id\n_atom_site.label_asym_id\n_atom_site.label_seq_id\n_atom_site.Cartn_x\n_atom_site.Cartn_y\n_atom_site.Cartn_z\nATOM 1 C CA ALA A 1 1.0 2.0 3.0\nHETATM 2 O O HOH A 2 4.0 5.0 6.0\n`;

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
    expect(result.structure.scientificHash).toHaveLength(64);
    expect(result.renderSource.content).toBe(pdbFixture);
  });

  it("parses the admitted mmCIF atom site loop", async () => {
    const result = await new StructureIngestionService().ingestLocal("sample.mmcif", Buffer.from(cifFixture));
    expect(result.structure.format).toBe("mmcif");
    expect(result.structure.counts).toMatchObject({ atoms: 2, polymerAtoms: 1, waterAtoms: 1 });
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
    expect(result.structure.source).toMatchObject({ kind: "RCSB", uri: "https://files.rcsb.org/download/1ABC.cif", originalFilename: "1ABC.cif" });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("retains explicit PDB CONECT topology without inferring bonds", async () => {
    const content = `ATOM      1  C1  LIG A 101       1.000   2.000   3.000  1.00 20.00           C  \nATOM      2  O1  LIG A 101       2.000   2.000   3.000  1.00 20.00           O  \nCONECT    1    2\nEND\n`;
    const result = await new StructureIngestionService().ingestLocal("bonded.pdb", Buffer.from(content));
    expect(result.structure.bonds).toHaveLength(1);
    expect(result.structure.bonds[0]).toMatchObject({ order: "SINGLE", source: "PDB_CONECT" });
    expect(result.structure.bonds[0].atom1).toBe(result.structure.atoms[0].stableId);
  });
});
