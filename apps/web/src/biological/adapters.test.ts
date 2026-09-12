import { describe, expect, it } from "vitest";
import { BiologicalAdapterError, detectBiologicalFormat, isMultiFrameXyz, parseBiologicalData } from "./adapters";

const mrcFixture = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(1024 + 8);
  const view = new DataView(buffer);
  view.setInt32(0, 2, true); view.setInt32(4, 1, true); view.setInt32(8, 1, true); view.setInt32(12, 2, true);
  view.setInt32(28, 2, true); view.setInt32(32, 1, true); view.setInt32(36, 1, true);
  view.setFloat32(40, 2, true); view.setFloat32(44, 44, true); view.setFloat32(48, 44, true);
  view.setFloat32(1024, 1.5, true); view.setFloat32(1028, -0.5, true);
  return buffer;
};

const dcdFixture = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(120);
  const view = new DataView(buffer);
  view.setInt32(0, 84, true); [67, 79, 82, 68].forEach((value, index) => view.setUint8(4 + index, value));
  view.setInt32(8, 2, true);
  view.setInt32(92, 4, true); view.setInt32(104, 4, true); view.setInt32(108, 3, true);
  return buffer;
};

const trajectoryHeaderFixture = (magic: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(4); new DataView(buffer).setInt32(0, magic, false); return buffer;
};

describe("biological data adapters", () => {
  it("parses sequence families without creating coordinates", () => {
    const fasta = parseBiologicalData("example.fasta", ">alpha description\nACGTN\n>beta\nMPEP");
    const fastq = parseBiologicalData("reads.fastq", "@read-1 sample\nACGT\n+\nIIII");
    const genbank = parseBiologicalData("record.gb", "LOCUS       TEST  8 bp\nORIGIN\n        1 acgtacgt\n//");
    const embl = parseBiologicalData("record.embl", "ID   TEST; SV 1;\nSQ   Sequence 8 BP;\n     acgtacgt\n//");
    if (fasta.kind !== "SEQUENCE" || fastq.kind !== "SEQUENCE_QUALITY" || genbank.kind !== "SEQUENCE" || embl.kind !== "SEQUENCE") throw new Error("sequence adapters returned the wrong data kind");
    expect(fasta.kind).toBe("SEQUENCE");
    expect(fastq.kind).toBe("SEQUENCE_QUALITY");
    expect(fastq.records[0]?.quality).toHaveLength(4);
    expect(genbank.records[0]?.sequence).toBe("ACGTACGT");
    expect(embl.records[0]?.sequence).toBe("ACGTACGT");
    expect("atoms" in fasta).toBe(false);
  });

  it("parses maps and preserves completeness and density metadata", () => {
    const dx = parseBiologicalData("map.dx", "object 1 class gridpositions counts 2 2 1\norigin 0 0 0\ndelta 1 0 0\ndelta 0 2 0\ndelta 0 0 3\nobject 2 class array type double rank 0 items 4 data follows\n1 2 3 4");
    const mrc = parseBiologicalData("map.mrc", mrcFixture());
    if (dx.kind !== "MAP" || mrc.kind !== "MAP") throw new Error("map adapters returned the wrong data kind");
    expect(dx.kind).toBe("MAP");
    expect(dx.grid.dataComplete).toBe(true);
    expect(dx.grid.spacing).toEqual([1, 2, 3]);
    expect(mrc.kind).toBe("MAP");
    expect(mrc.grid.values).toEqual([1.5, -0.5]);
    expect(mrc.grid.valueRange.mean).toBe(0.5);
  });

  it("parses ready trajectories and marks binary trajectories header-only", () => {
    const xyz = "2\nframe one\nC 0 0 0\nO 1 0 0\n2\nframe two\nC 0 1 0\nO 1 1 0\n";
    const trajectory = parseBiologicalData("movie.xyz-trajectory", xyz);
    const gro = parseBiologicalData("frame.gro", "Test frame\n2\n    1ALA    CA    1   0.100   0.200   0.300\n    1ALA    CB    2   0.200   0.300   0.400\n   1.0 1.0 1.0\n");
    const dcd = parseBiologicalData("movie.dcd", dcdFixture());
    const xtc = parseBiologicalData("movie.xtc", trajectoryHeaderFixture(1995));
    const trr = parseBiologicalData("movie.trr", trajectoryHeaderFixture(1993));
    if (trajectory.kind !== "TRAJECTORY" || gro.kind !== "TRAJECTORY" || dcd.kind !== "TRAJECTORY" || xtc.kind !== "TRAJECTORY" || trr.kind !== "TRAJECTORY") throw new Error("trajectory adapters returned the wrong data kind");
    expect(isMultiFrameXyz(xyz)).toBe(true);
    expect(trajectory.kind).toBe("TRAJECTORY");
    expect(trajectory.status).toBe("READY");
    expect(trajectory.frames).toHaveLength(2);
    expect(gro.frames[0]?.atoms[0]?.x).toBeCloseTo(1);
    expect(dcd.status).toBe("HEADER_ONLY");
    expect(dcd.atomCount).toBe(3);
    expect(dcd.frames).toHaveLength(0);
    expect(xtc.status).toBe("HEADER_ONLY");
    expect(trr.status).toBe("HEADER_ONLY");
  });

  it("parses topology and notation sources as separate data kinds", () => {
    const psf = parseBiologicalData("system.psf", "PSF\n\n       3 !NATOM\n       1 SEG 1 ALA N N 0.0 14.0 0\n       2 SEG 1 ALA CA C 0.0 12.0 0\n       3 SEG 1 ALA C C 0.0 12.0 0\n\n       2 !NBOND: bonds\n       1       2       2       3\n");
    const prmtop = parseBiologicalData("system.prmtop", "%FLAG POINTERS\n%FORMAT(10I8)\n       3       0       3       0       0       0       0       0       0       0       0       1\n%FLAG ATOM_NAME\n");
    const smiles = parseBiologicalData("molecules.smi", "ethanol\tCCO\nbenzene\tc1ccccc1");
    if (psf.kind !== "TOPOLOGY" || prmtop.kind !== "TOPOLOGY" || smiles.kind !== "SMILES") throw new Error("topology adapters returned the wrong data kind");
    expect(psf.kind).toBe("TOPOLOGY");
    expect(psf.atomCount).toBe(3);
    expect(psf.bondCount).toBe(2);
    expect(prmtop.residueCount).toBe(1);
    expect(smiles.kind).toBe("SMILES");
    expect(smiles.records[0]).toMatchObject({ name: "ethanol", notation: "CCO" });
  });

  it("supports an explicit paste format even when the filename has another suffix", () => {
    const parsed = parseBiologicalData("pasted-data.fasta", "LOCUS       TEST  4 bp\nORIGIN\n        1 acgt\n//", "genbank");
    expect(parsed.kind).toBe("SEQUENCE");
    expect(parsed.format).toBe("genbank");
  });

  it("fails closed for malformed or unknown input", () => {
    expect(detectBiologicalFormat("unknown.bin", "binary")).toBeNull();
    expect(() => parseBiologicalData("bad.fastq", "@read\nACGT\n+\nIII")).toThrow(BiologicalAdapterError);
    expect(() => parseBiologicalData("bad.dx", "object 1 class gridpositions counts 2 2 1")).toThrow(BiologicalAdapterError);
    expect(() => parseBiologicalData("bad.xtc", trajectoryHeaderFixture(0))).toThrow(BiologicalAdapterError);
    expect(() => parseBiologicalData("bad.smi", "binary")).toThrow(BiologicalAdapterError);
  });
});
