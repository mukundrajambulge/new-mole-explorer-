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

const concat = (parts: Uint8Array[]): ArrayBuffer => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0)); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result.buffer;
};

const dcdRecord = (payload: Uint8Array): Uint8Array => {
  const record = new Uint8Array(payload.byteLength + 8); const view = new DataView(record.buffer);
  view.setInt32(0, payload.byteLength, true); record.set(payload, 4); view.setInt32(payload.byteLength + 4, payload.byteLength, true); return record;
};

const dcdFixture = (): ArrayBuffer => {
  const headerPayload = new Uint8Array(84); const headerView = new DataView(headerPayload.buffer);
  headerPayload.set([67, 79, 82, 68], 0); headerView.setInt32(4, 2, true); headerView.setInt32(8, 10, true); headerView.setInt32(12, 5, true);
  const titlePayload = new Uint8Array(4); const atomPayload = new Uint8Array(4); new DataView(atomPayload.buffer).setInt32(0, 3, true);
  const frame = (values: number[][]) => concat(values.map((axis) => { const payload = new Uint8Array(axis.length * 4); const view = new DataView(payload.buffer); axis.forEach((value, index) => view.setFloat32(index * 4, value, true)); return dcdRecord(payload); }));
  return concat([dcdRecord(headerPayload), dcdRecord(titlePayload), dcdRecord(atomPayload), new Uint8Array(frame([[0, 1, 2], [0, 0, 0], [0, 0, 0]])), new Uint8Array(frame([[0.1, 1.1, 2.1], [0.2, 0.2, 0.2], [0.3, 0.3, 0.3]]))]);
};

const trrFixture = (): ArrayBuffer => {
  const frame = (step: number, coordinates: number[]): Uint8Array => {
    const payload = new Uint8Array(4 + 4 + 3 + (10 + 3) * 4 + coordinates.length * 4); const view = new DataView(payload.buffer); let offset = 0;
    view.setInt32(offset, 1993, false); offset += 4; view.setInt32(offset, 3, false); offset += 4; payload.set([49, 46, 48], offset); offset += 3;
    const sizes = [0, 0, 0, 0, 0, 0, 0, coordinates.length * 4, 0, 0, coordinates.length / 3, step, 0]; sizes.forEach((value) => { view.setInt32(offset, value, false); offset += 4; });
    coordinates.forEach((value) => { view.setFloat32(offset, value, false); offset += 4; }); return payload;
  };
  return concat([frame(1, [0, 0, 0, 1, 0, 0]), frame(2, [0, 0.5, 0, 1, 0.5, 0])]);
};

const dcdBigEndianFixture = (): ArrayBuffer => {
  const record = (payload: Uint8Array): Uint8Array => { const result = new Uint8Array(payload.byteLength + 8); const view = new DataView(result.buffer); view.setInt32(0, payload.byteLength, false); result.set(payload, 4); view.setInt32(payload.byteLength + 4, payload.byteLength, false); return result; };
  const headerPayload = new Uint8Array(84); const headerView = new DataView(headerPayload.buffer); headerPayload.set([67, 79, 82, 68], 0); headerView.setInt32(4, 1, false); headerView.setInt32(8, 1, false); headerView.setInt32(12, 1, false); headerView.setInt32(80, 24, false);
  const atomPayload = new Uint8Array(4); new DataView(atomPayload.buffer).setInt32(0, 3, false);
  const floats = (values: number[]) => { const payload = new Uint8Array(values.length * 4); const view = new DataView(payload.buffer); values.forEach((value, index) => view.setFloat32(index * 4, value, false)); return record(payload); };
  const cellPayload = new Uint8Array(48); const cellView = new DataView(cellPayload.buffer); [10, 11, 12, 90, 90, 90].forEach((value, index) => cellView.setFloat64(index * 8, value, false));
  return concat([record(headerPayload), record(new Uint8Array(4)), record(atomPayload), record(cellPayload), floats([0, 1, 2]), floats([0, 1, 2]), floats([0, 0, 0])]);
};

const trrDoubleFixture = (): ArrayBuffer => {
  const payload = new Uint8Array(4 + 4 + 3 + (10 + 3) * 4 + 2 * 3 * 8); const view = new DataView(payload.buffer); let offset = 0;
  view.setInt32(offset, 1993, false); offset += 4; view.setInt32(offset, 3, false); offset += 4; payload.set([49, 46, 48], offset); offset += 3;
  const sizes = [0, 0, 0, 0, 0, 0, 0, 2 * 3 * 8, 0, 0, 2, 3, 0]; sizes.forEach((value) => { view.setInt32(offset, value, false); offset += 4; });
  [0, 0, 0, 1, 0.25, 0].forEach((value) => { view.setFloat64(offset, value, false); offset += 8; });
  return payload.buffer;
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

  it("parses ready trajectories and decodes DCD/TRR binary frames while keeping XTC bounded", () => {
    const xyz = "2\nframe one\nC 0 0 0\nO 1 0 0\n2\nframe two\nC 0 1 0\nO 1 1 0\n";
    const trajectory = parseBiologicalData("movie.xyz-trajectory", xyz);
    const gro = parseBiologicalData("frame.gro", "Test frame\n2\n    1ALA    CA    1   0.100   0.200   0.300\n    1ALA    CB    2   0.200   0.300   0.400\n   1.0 1.0 1.0\n");
    const dcd = parseBiologicalData("movie.dcd", dcdFixture());
    const xtc = parseBiologicalData("movie.xtc", trajectoryHeaderFixture(1995));
    const trr = parseBiologicalData("movie.trr", trrFixture());
    if (trajectory.kind !== "TRAJECTORY" || gro.kind !== "TRAJECTORY" || dcd.kind !== "TRAJECTORY" || xtc.kind !== "TRAJECTORY" || trr.kind !== "TRAJECTORY") throw new Error("trajectory adapters returned the wrong data kind");
    expect(isMultiFrameXyz(xyz)).toBe(true);
    expect(trajectory.kind).toBe("TRAJECTORY");
    expect(trajectory.status).toBe("READY");
    expect(trajectory.frames).toHaveLength(2);
    expect(gro.frames[0]?.atoms[0]?.x).toBeCloseTo(1);
    expect(dcd.status).toBe("READY");
    expect(dcd.atomCount).toBe(3);
    expect(dcd.frames).toHaveLength(2);
    expect(dcd.frames[1]?.atoms[2]?.x).toBeCloseTo(2.1);
    expect(xtc.status).toBe("HEADER_ONLY");
    expect(trr.status).toBe("READY");
    expect(trr.frames).toHaveLength(2);
    expect(trr.frames[1]?.atoms[1]?.y).toBeCloseTo(0.5);
  });

  it("handles big-endian DCD unit-cell records and double-precision TRR coordinates", () => {
    const dcd = parseBiologicalData("big-endian.dcd", dcdBigEndianFixture());
    const trr = parseBiologicalData("double.trr", trrDoubleFixture());
    if (dcd.kind !== "TRAJECTORY" || trr.kind !== "TRAJECTORY") throw new Error("binary trajectory adapters returned the wrong data kind");
    expect(dcd.kind).toBe("TRAJECTORY");
    expect(dcd.status).toBe("READY");
    expect(dcd.frames[0]?.atoms[1]?.y).toBeCloseTo(1);
    expect(trr.kind).toBe("TRAJECTORY");
    expect(trr.status).toBe("READY");
    expect(trr.frames[0]?.atoms[1]?.y).toBeCloseTo(0.25);
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
