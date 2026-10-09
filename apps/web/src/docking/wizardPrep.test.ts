import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanonicalAtom, PrepJobStateV1 } from "@molecular/contracts";
import { ligandPdbFromAtoms, prepFormatForFile } from "./wizardLogic";
import { prepBlockReason, VINA_EXPERIMENTAL_BANNER } from "./wizardPrepGate";

const pdb = readFileSync(fileURLToPath(new URL("../../../../tests/fixtures/rcsb/1STP.pdb", import.meta.url)), "utf8");
const btnLines = pdb.split(/\r?\n/).filter((l) => l.startsWith("HETATM") && l.slice(17, 20) === "BTN");
const atomFrom = (l: string): CanonicalAtom => ({
  stableId: l.slice(6, 11).trim(), serial: Number(l.slice(6, 11)), atomName: l.slice(12, 16).trim(), element: l.slice(76, 78).trim(), residueName: l.slice(17, 20).trim(),
  residueNumber: Number(l.slice(22, 26)), chain: l.slice(21, 22), x: Number(l.slice(30, 38)), y: Number(l.slice(38, 46)), z: Number(l.slice(46, 54)), recordType: "HETATM",
  isPolymer: false, isLigand: true, isWater: false, isIon: false, occupancy: Number(l.slice(54, 60)), bFactor: Number(l.slice(60, 66)),
});

describe("ligand PDB for the prep worker (real 1STP biotin)", () => {
  it("rewrites the HETATM records column-exact from the parsed atoms (no added chemistry)", () => {
    expect(btnLines.length).toBe(16);
    const out = ligandPdbFromAtoms(btnLines.map(atomFrom)).trimEnd().split("\n");
    expect(out.at(-1)).toBe("END");
    const records = out.slice(0, -1);
    expect(records).toHaveLength(16);
    for (let i = 0; i < records.length; i += 1) {
      // name, residue, chain, resSeq, coordinates, occupancy, B (columns 13-66) and element (77-78) are identical
      expect(records[i]!.slice(12, 66)).toBe(btnLines[i]!.slice(12, 66));
      expect(records[i]!.slice(76, 78)).toBe(btnLines[i]!.slice(76, 78));
    }
  });
  it("admits only prep worker formats", () => {
    expect(prepFormatForFile("x.SDF")).toBe("sdf");
    expect(prepFormatForFile("x.cif")).toBeNull();
  });
});

const base: PrepJobStateV1 = { schemaVersion: 1, jobId: "j1", state: "AWAITING_CONFIRMATION", createdAt: "", expiresAt: "" };
const plan = (status: "READY" | "BLOCKED" | "UNSUPPORTED", diagnostics: string[]) => ({ schemaVersion: 1 as const, jobId: "j1", receptorArtifactId: "r", ligandArtifactId: "l", pH: 7.4, protonationSource: "EXPLICIT_SUBMITTED" as const, chargeModel: "gasteiger", tautomer: "as submitted", rotatableBonds: 5, decisions: [], warnings: [], planDigest: "a".repeat(64), status, diagnostics });

describe("prep gate for the Run step", () => {
  it("blocks BLOCKED / UNSUPPORTED plans with the worker's reason", () => {
    expect(prepBlockReason({ ...base, plan: plan("UNSUPPORTED", ["CHEMISTRY_UNSUPPORTED: metal ZN in site"]) })).toBe("Preparation is UNSUPPORTED: CHEMISTRY_UNSUPPORTED: metal ZN in site");
    expect(prepBlockReason({ ...base, plan: plan("BLOCKED", ["LIGAND_BOND_ORDERS_UNKNOWN"]) })).toContain("BLOCKED");
    expect(prepBlockReason({ ...base, plan: plan("READY", []) })).toBeNull();
  });
  it("blocks a finished prep without dockable ids and admits preview ids", () => {
    expect(prepBlockReason({ ...base, state: "SUCCEEDED", seal: { status: "REJECTED", qualification: "INTERIM", reasonCodes: ["OUTPUT_HASH"], verifiedOutputs: 0 } })).toContain("REJECTED: OUTPUT_HASH");
    expect(prepBlockReason({ ...base, state: "SUCCEEDED", previewReceptorId: "pvrec_x", previewLigandId: "pvlig_x" })).toBeNull();
  });
  it("banner states the capability and carries no affinity wording", () => {
    expect(VINA_EXPERIMENTAL_BANNER).toContain("EXPERIMENTAL");
    expect(VINA_EXPERIMENTAL_BANNER).not.toMatch(/affinit/i);
  });
});
