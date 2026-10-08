import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import { boxAroundAtoms, boxProblem, hbondLines, isStaleForStructure, parsePoseAtoms, rmsd, splitByRole, toJobArtifactId, ligandComponentId } from "./wizardLogic";

describe("ligandComponentId", () => {
  const src = `source_pdb_${"a".repeat(64)}`;
  it("differs from the receptor id, per component, and fits the contract", () => {
    const a = ligandComponentId(src, "A:STI:1");
    expect(a).not.toBe(toJobArtifactId(src));
    expect(a).not.toBe(ligandComponentId(src, "B:STI:1"));
    expect(a).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
    expect(a.length).toBeLessThanOrEqual(64);
  });
});

const pdb = readFileSync(fileURLToPath(new URL("../../../../tests/fixtures/rcsb/4DJW.pdb", import.meta.url)), "utf8");

// Atoms built from the real 4DJW coordinates; roles follow the HETATM/ATOM record and residue name.
const atomsFrom = (text: string): CanonicalAtom[] => text.split("\n").filter((l) => l.startsWith("ATOM") || l.startsWith("HETATM")).map((l, i) => {
  const hetero = l.startsWith("HETATM");
  const res = l.slice(17, 20).trim();
  const water = res === "HOH";
  return { stableId: String(i), serial: i, atomName: l.slice(12, 16).trim(), element: l.slice(76, 78).trim(), residueName: res, residueNumber: Number(l.slice(22, 26)), chain: l.slice(21, 22), x: Number(l.slice(30, 38)), y: Number(l.slice(38, 46)), z: Number(l.slice(46, 54)), recordType: hetero ? "HETATM" : "ATOM", isPolymer: !hetero, isLigand: hetero && !water, isWater: water, isIon: false } as CanonicalAtom;
});

describe("docking wizard logic on 4DJW", () => {
  const atoms = atomsFrom(pdb);
  const split = splitByRole({ atoms } as unknown as CanonicalMolecularStructure);
  it("splits receptor and ligand by role", () => {
    expect(split.receptor.atomCount).toBeGreaterThan(1000);
    expect(split.ligands.map((l) => l.label.split(" ")[0])).toContain("0KP");
    const kp = split.ligands.filter((l) => l.label.startsWith("0KP"));
    expect(kp.reduce((n, l) => n + l.atomCount, 0)).toBe(52);
    expect(kp.length).toBeGreaterThan(1);
  });
  it("builds a contract-valid box around the ligand", () => {
    const lig = split.ligands.find((l) => l.label.startsWith("0KP"))!;
    const box = boxAroundAtoms(lig.atoms)!;
    expect(boxProblem(box.center, box.size)).toBeNull();
    expect(boxAroundAtoms(lig.atoms.slice(0, 1), 0)!.size).toEqual([1, 1, 1]);
    expect(boxAroundAtoms([])).toBeNull();
  });
  it("rejects boxes outside the contract", () => {
    expect(boxProblem([0, 0, 0], [41, 10, 10])).toMatch(/between/);
    expect(boxProblem([NaN, 0, 0], [10, 10, 10])).toMatch(/finite/);
  });
  it("computes RMSD and H-bond lines from real coordinates", () => {
    const lig = parsePoseAtoms(pdb.split("\n").filter((l) => l.startsWith("HETATM") && l.slice(17, 20) === "0KP").join("\n"), "pdbqt");
    expect(lig.length).toBe(52);
    expect(rmsd(lig, lig)).toBe(0);
    expect(rmsd(lig, lig.map((a) => ({ ...a, x: a.x + 2 })))).toBeCloseTo(2, 6);
    expect(rmsd(lig, lig.slice(1))).toBeNull();
    expect(hbondLines(lig, atoms).every((l) => l.distance <= 3.5)).toBe(true);
  });
  it("detects stale replies by structure hash", () => {
    expect(isStaleForStructure("a", "a")).toBe(false);
    expect(isStaleForStructure("a", "b")).toBe(true);
    expect(isStaleForStructure("a", null)).toBe(true);
  });
  it("shortens long artifact ids to the contract limit", () => {
    expect(toJobArtifactId("short-id")).toBe("short-id");
    expect(toJobArtifactId(`source_local_upload_${"a".repeat(64)}`).length).toBeLessThanOrEqual(64);
  });
});
