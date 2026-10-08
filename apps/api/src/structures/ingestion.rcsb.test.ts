import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StructureIngestionService } from "./ingestion.js";

const rcsbDir = new URL("../../../../tests/fixtures/rcsb/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, rcsbDir));
const ingest = (name: string, content: Buffer | string) => new StructureIngestionService().ingestLocal(name, Buffer.isBuffer(content) ? content : Buffer.from(content));

type Structure = Awaited<ReturnType<typeof ingest>>["structure"];
type Atom = Structure["atoms"][number];
/** Distinct residues (chain|number|insertion code|name) that hold at least one matching atom, in file order. */
const residueList = (structure: Structure, keep: (atom: Atom) => boolean): string[] => {
  const seen = new Set<string>();
  for (const atom of structure.atoms) if (keep(atom)) seen.add([atom.chain, atom.residueNumber, atom.insertionCode ?? "", atom.residueName].join("|"));
  return [...seen];
};
const ligandList = (structure: Structure) => residueList(structure, (atom) => atom.isLigand);

const cifHeader =["group_PDB", "id", "type_symbol", "label_atom_id", "label_comp_id", "label_asym_id", "label_seq_id", "auth_seq_id", "auth_asym_id", "pdbx_PDB_ins_code", "Cartn_x", "Cartn_y", "Cartn_z", "pdbx_PDB_model_num"].map((name) => `_atom_site.${name}`);

describe("RCSB fixture manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", rcsbDir), "utf8")) as { files: Array<{ name: string; sha256: string; bytes: number; url: string; downloaded: string; tracked: boolean }> };
  it("pins every committed file by sha256, size, url and date, each under 5 MB", () => {
    for (const entry of manifest.files) {
      expect(entry.url).toMatch(/^https:\/\/files\.rcsb\.org\//);
      expect(entry.downloaded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (!entry.tracked) {
        expect(entry.name.startsWith("4V6F")).toBe(true);
        continue;
      }
      const bytes = read(entry.name);
      expect(bytes.length).toBe(entry.bytes);
      expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    }
  });
});

describe("PDB and mmCIF of the same RCSB entry agree", () => {
  for (const id of ["1CRN", "4DJW", "1D3Z", "1HZH", "6VXX", "5FYL"]) {
    it(`${id}: same chains, residues and atoms`, async () => {
      const pdb = (await ingest(`${id}.pdb`, read(`${id}.pdb`))).structure;
      const cif = (await ingest(`${id}.cif`, read(`${id}.cif`))).structure;
      expect(cif.hierarchy.chainIds).toEqual(pdb.hierarchy.chainIds);
      const residueSummary = (structure: typeof pdb) => Object.values(structure.hierarchy.residues).map((residue) => [residue.id, residue.name, residue.number, residue.insertionCode ?? "", residue.atomIds.length]);
      expect(residueSummary(cif)).toEqual(residueSummary(pdb));
      expect(cif.atoms.length).toBe(pdb.atoms.length);
      const atomSummary = (structure: typeof pdb) => structure.atoms.map((atom) => [atom.atomName, atom.residueName, atom.residueNumber, atom.insertionCode ?? "", atom.chain, atom.element, atom.altLoc ?? "", atom.recordType, atom.x, atom.y, atom.z].join("|"));
      expect(atomSummary(cif)).toEqual(atomSummary(pdb));
      expect(cif.coordinateStates?.map((state) => state.sourceModelNumber)).toEqual(pdb.coordinateStates?.map((state) => state.sourceModelNumber));
      expect(Object.keys(cif.hierarchy.residues).length).toBe(Object.keys(pdb.hierarchy.residues).length);
      expect(cif.counts.residues).toBe(pdb.counts.residues);
      expect(cif.counts.chains).toBe(pdb.counts.chains);
      expect(cif.counts.waterAtoms).toBe(pdb.counts.waterAtoms);
      expect(cif.counts.ionAtoms).toBe(pdb.counts.ionAtoms);
      expect(ligandList(cif)).toEqual(ligandList(pdb));
      expect(residueList(cif, (atom) => atom.isWater)).toEqual(residueList(pdb, (atom) => atom.isWater));
    }, 120_000);
  }

  it("keeps each water and ligand as its own residue on its author chain", async () => {
    const pdb = (await ingest("4DJW.pdb", read("4DJW.pdb"))).structure;
    const cif = (await ingest("4DJW.cif", read("4DJW.cif"))).structure;
    const waters = residueList(cif, (atom) => atom.isWater);
    expect(waters.length).toBeGreaterThan(10);
    expect(new Set(waters).size).toBe(waters.length);
    expect(ligandList(cif).length).toBeGreaterThan(0);
    const polymerChains = new Set(pdb.atoms.filter((atom) => atom.isPolymer).map((atom) => atom.chain));
    for (const atom of cif.atoms) if (atom.isWater || atom.isLigand) expect(polymerChains.has(atom.chain), `${atom.residueName} ${atom.chain}`).toBe(true);
  });

  it("types every polymer atom of the single-entity entries from _entity_poly", async () => {
    for (const id of ["1CRN", "1D3Z", "4DJW", "6VXX"]) {
      const cif = (await ingest(`${id}.cif`, read(`${id}.cif`))).structure;
      expect(cif.polymerTypingSource, id).toMatch(/_entity_poly\.type/);
      const polymerAtoms = cif.atoms.filter((atom) => atom.recordType === "ATOM");
      expect(polymerAtoms.length, id).toBeGreaterThan(0);
      expect(polymerAtoms.every((atom) => atom.polymerType === "PROTEIN"), id).toBe(true);
    }
  }, 120_000);

  it("keeps label_* identity next to auth_* identity", async () => {
    const cif = (await ingest("4DJW.cif", read("4DJW.cif"))).structure;
    const water = cif.atoms.find((atom) => atom.isWater)!;
    expect(water.labelAsymId).toBeDefined();
    expect(water.labelAsymId).not.toBe(water.chain);
    expect(water.labelSeqId).toBeUndefined();
  });

  it("reads insertion codes from the antibody entry", async () => {
    const cif = (await ingest("1HZH.cif", read("1HZH.cif"))).structure;
    expect(Object.values(cif.hierarchy.residues).some((residue) => residue.insertionCode)).toBe(true);
  });

  it("keeps every model of the NMR entry", async () => {
    const cif = (await ingest("1D3Z.cif", read("1D3Z.cif"))).structure;
    expect(cif.coordinateStates?.map((state) => state.sourceModelNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("mmCIF syntax rules", () => {
  const atomRow = (id: number, atom: string, comp = "ALA") => `ATOM ${id} C ${atom} ${comp} A 1 1 A ? ${id}.0 0.0 0.0 1`;
  const doc = (rows: string[], extra = "") => `data_t\n${extra}loop_\n${cifHeader.join("\n")}\n${rows.join("\n")}\n`;

  it("closes quotes only before whitespace", async () => {
    const result = (await ingest("q.cif", doc([atomRow(1, `"O5'"`), atomRow(2, `'C1"x'`), atomRow(3, "CB")]))).structure;
    expect(result.atoms.map((atom) => atom.atomName)).toEqual(["O5'", 'C1"x', "CB"]);
  });

  it("reads ; text fields, including ones that look like keywords", async () => {
    const extra = "_struct.title\n;loop_\n_atom_site.id\ndata_x\n;\n_entity.details\n;\nline one\n'quoted' line\n;\n";
    const result = (await ingest("t.cif", doc([atomRow(1, "CA"), atomRow(2, "CB")], extra))).structure;
    expect(result.atoms).toHaveLength(2);
  });

  it("treats . and ? as null and keeps the insertion code", async () => {
    const rows = ["ATOM 1 C CA ALA A 1 1 A . 1.0 0.0 0.0 1", "ATOM 2 C CA ALA A 1 1 A 'B' 2.0 0.0 0.0 1"];
    const result = (await ingest("n.cif", doc(rows))).structure;
    expect(result.atoms.map((atom) => atom.insertionCode)).toEqual([undefined, "B"]);
  });

  it("uses auth_* as the primary identity and keeps label_*", async () => {
    const row = "ATOM 1 C CA ALA X 7 107 B C 1.0 0.0 0.0 1";
    const atom = (await ingest("a.cif", doc([row]))).structure.atoms[0]!;
    expect(atom).toMatchObject({ chain: "B", residueNumber: 107, insertionCode: "C", labelAsymId: "X", labelSeqId: 7 });
  });

  it("falls back from auth to label per row, never mixing the two systems in one row", async () => {
    const rows = [
      "ATOM 1 C CA ALA A 1 101 B ? 1.0 0.0 0.0 1",
      "ATOM 2 C CA ALA A 2 ? ? ? 2.0 0.0 0.0 1",
      "ATOM 3 C CA ALA A 3 ? B ? 3.0 0.0 0.0 1",
      "HETATM 4 O O HOH C . 201 B ? 4.0 0.0 0.0 1",
      "HETATM 5 O O HOH C . 202 B ? 5.0 0.0 0.0 1",
    ];
    const result = (await ingest("r.cif", doc(rows))).structure;
    expect(result.atoms.map((atom) => `${atom.chain}${atom.residueNumber}`)).toEqual(["B101", "A2", "A3", "B201", "B202"]);
    expect(result.atoms.slice(3).map((atom) => [atom.labelAsymId, atom.labelSeqId])).toEqual([["C", undefined], ["C", undefined]]);
    expect(Object.keys(result.hierarchy.residues)).toHaveLength(5);
  });

  it("never pairs an auth chain with a label number when both systems are incomplete", async () => {
    const rows = [
      "ATOM 1 C CA ALA . 5 ? B ? 1.0 0.0 0.0 1",
      "ATOM 2 C CA ALA A 6 ? ? ? 2.0 0.0 0.0 1",
      "ATOM 3 C CA ALA . . 9 ? ? 3.0 0.0 0.0 1",
    ];
    const atoms = (await ingest("p.cif", doc(rows))).structure.atoms;
    expect(atoms.map((atom) => `${atom.chain}${atom.residueNumber}`)).toEqual(["B0", "A6", "_9"]);
    expect(atoms[0]).toMatchObject({ labelSeqId: 5 });
  });

  it("resolves struct_conn partners by label ids when the row has no auth ids", async () => {
    const rows = ["ATOM 1 S SG CYS A 1 101 B ? 1.0 0.0 0.0 1", "ATOM 2 S SG CYS A 2 102 B ? 3.0 0.0 0.0 1"];
    const conn = ["id", "conn_type_id", "ptnr1_label_asym_id", "ptnr1_label_seq_id", "ptnr1_label_atom_id", "ptnr1_auth_asym_id", "ptnr1_auth_seq_id", "ptnr2_label_asym_id", "ptnr2_label_seq_id", "ptnr2_label_atom_id", "ptnr2_auth_asym_id", "ptnr2_auth_seq_id"];
    const values = ["disulf1", "disulf", "A", "1", "SG", "?", "?", "A", "2", "SG", "?", "?"];
    const extra = conn.map((name, index) => `_struct_conn.${name} ${values[index]}`).join("\n") + "\n";
    const result = (await ingest("c.cif", doc(rows, extra))).structure;
    expect(result.bonds.filter((bond) => bond.source === "MMCIF_STRUCT_CONN")).toHaveLength(1);
  });

  it("reads single-row categories written as key/value pairs", async () => {
    const content = `data_s\n_cell.length_a 10.0\n_cell.length_b 11.0\n_cell.length_c 12.0\n_cell.angle_alpha 90\n_cell.angle_beta 90\n_cell.angle_gamma 90\n_atom_site.group_PDB ATOM\n_atom_site.id 1\n_atom_site.type_symbol C\n_atom_site.label_atom_id CA\n_atom_site.label_comp_id ALA\n_atom_site.label_asym_id A\n_atom_site.label_seq_id 1\n_atom_site.Cartn_x 1.0\n_atom_site.Cartn_y 2.0\n_atom_site.Cartn_z 3.0\n`;
    const result = (await ingest("s.cif", content)).structure;
    expect(result.atoms).toHaveLength(1);
    expect(result.atoms[0]).toMatchObject({ atomName: "CA", x: 1, y: 2, z: 3 });
    expect(result.unitCell).toMatchObject({ a: 10, b: 11, c: 12 });
  });

  it("types polymers from a single-row _entity_poly category", async () => {
    const extra = "_entity_poly.entity_id 1\n_entity_poly.type 'polypeptide(L)'\n_entity_poly.pdbx_seq_one_letter_code\n;AA\n;\n";
    const header = [...cifHeader, "_atom_site.label_entity_id"];
    const content = `data_p\n${extra}loop_\n${header.join("\n")}\n${atomRow(1, "CA")} 1\n${atomRow(2, "CB")} 1\n`;
    const result = (await ingest("p.cif", content)).structure;
    expect(result.polymerTypingSource).toMatch(/_entity_poly\.type/);
    expect(result.atoms.map((atom) => atom.polymerType)).toEqual(["PROTEIN", "PROTEIN"]);
  });

  it("handles CRLF line endings in text fields and unterminated quotes", async () => {
    const extra = "_struct.title\r\n;first line\r\n_atom_site.id 'still text'\r\n;\r\n_struct.pdbx_descriptor 'open quote\r\n";
    const content = doc([atomRow(1, "CA"), atomRow(2, "CB")], extra).replace(/\n/g, "\r\n").replace(/\r\r\n/g, "\r\n");
    const result = (await ingest("crlf.cif", content)).structure;
    expect(result.atoms.map((atom) => atom.atomName)).toEqual(["CA", "CB"]);
  });

  it("treats reserved words case-insensitively and reads only the first data block", async () => {
    const content = doc([atomRow(1, "CA")]).replace("loop_", "LOOP_") + `DATA_second\nloop_\n${cifHeader.join("\n")}\n${atomRow(9, "CB")}\n`;
    const result = (await ingest("b.cif", content)).structure;
    expect(result.atoms.map((atom) => atom.atomName)).toEqual(["CA"]);
  });

  it("rejects a loop whose values do not fill whole rows", async () => {
    const content = doc([atomRow(1, "CA"), "ATOM 2 C CB ALA A 1 1 A ?"]);
    await expect(ingest("bad.cif", content)).rejects.toThrow(/not a multiple/);
  });

  it("keeps model numbers as coordinate states", async () => {
    const rows = [atomRow(1, "CA") + "", "ATOM 1 C CA ALA A 1 1 A ? 4.0 0.0 0.0 3"];
    const result = (await ingest("m.cif", doc(rows))).structure;
    expect(result.coordinateStates?.map((state) => state.sourceModelNumber)).toEqual([1, 3]);
  });
});

describe("PDB hybrid-36 serials", () => {
  const line = (serial: string, residue: string) => `ATOM  ${serial.padStart(5)}  CA  ALA A${residue.padStart(4)}       1.000   2.000   3.000  1.00 20.00           C`;
  it("decodes serials and residue numbers past the fixed-width limits", async () => {
    const content = [line("99999", "9999"), line("A0000", "A000"), line("A0001", "A001"), line("a0000", "a000")].join("\n");
    const result = (await ingest("h.pdb", content)).structure;
    expect(result.atoms.map((atom) => atom.serial)).toEqual([99999, 100000, 100001, 43770016]);
    expect(result.atoms.map((atom) => atom.residueNumber).slice(0, 3)).toEqual([9999, 10000, 10001]);
  });

  it("does not exist without the fixtures being present", () => {
    expect(existsSync(new URL("1CRN.pdb", rcsbDir))).toBe(true);
  });
});
