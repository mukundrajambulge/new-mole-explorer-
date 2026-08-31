import type { CanonicalBond, CanonicalMolecularStructure } from "@molecular/contracts";

export type CoordinateContext = {
  coordinateStateId: string;
  modelId: string;
  stateId: string;
  molecularRevision: string;
};

export type StableAtomRef = {
  structureId: string;
  stableAtomId: string;
  molecularRevision: string;
  coordinateContext: CoordinateContext;
};

export type StableBondRef = {
  structureId: string;
  bondId: string;
  endpoints: readonly [string, string];
  molecularRevision: string;
  coordinateContext: CoordinateContext;
};

type PickBase = {
  schemaVersion: 1;
  pickId: string;
  structureId: string;
  molecularRevision: string;
  rendererGeneration: number;
  coordinateContext: CoordinateContext;
  provenance: "renderer-reverse-identity-map" | "background-pointer";
};

export type AtomPickResult = PickBase & { pickKind: "ATOM"; atomRef: StableAtomRef };
export type BondPickResult = PickBase & { pickKind: "BOND"; bondRef: StableBondRef };
export type BackgroundPickResult = PickBase & { pickKind: "BACKGROUND" };
export type PickResult = AtomPickResult | BondPickResult | BackgroundPickResult;

export const coordinateContextFor = (structure: CanonicalMolecularStructure): CoordinateContext => ({
  coordinateStateId: `${structure.id}:coordinates:active`,
  modelId: structure.id,
  stateId: "active",
  molecularRevision: structure.scientificHash,
});

const pickId = (generation: number, serial: number) => `pick:${generation}:${serial}`;

export class ReverseIdentityMap {
  private readonly byRendererIndex = new Map<number, StableAtomRef>();
  private readonly byStableId = new Map<string, StableAtomRef>();
  private readonly byRendererSerial = new Map<number, StableAtomRef>();
  private readonly ambiguousSerials = new Set<number>();
  private structureId: string | null = null;
  private molecularRevision: string | null = null;
  private generation = 0;

  build(structure: CanonicalMolecularStructure, generation: number): void {
    this.byRendererIndex.clear();
    this.byStableId.clear();
    this.byRendererSerial.clear();
    this.ambiguousSerials.clear();
    this.structureId = structure.id;
    this.molecularRevision = structure.scientificHash;
    this.generation = generation;
    const coordinateContext = coordinateContextFor(structure);
    structure.atoms.forEach((atom, index) => {
      const ref: StableAtomRef = { structureId: structure.id, stableAtomId: atom.stableId, molecularRevision: structure.scientificHash, coordinateContext };
      this.byRendererIndex.set(index, ref);
      this.byStableId.set(atom.stableId, ref);
      if (this.ambiguousSerials.has(atom.serial)) return;
      if (!this.byRendererSerial.has(atom.serial)) this.byRendererSerial.set(atom.serial, ref);
      else { this.byRendererSerial.delete(atom.serial); this.ambiguousSerials.add(atom.serial); }
    });
  }

  resolveAtomHit(hit: { index?: number; serial?: number; properties?: Record<string, unknown> }): AtomPickResult | null {
    const stableId = typeof hit.properties?.canonicalStableId === "string" ? hit.properties.canonicalStableId : null;
    const ref = (stableId ? this.byStableId.get(stableId) : undefined) ?? (hit.index === undefined ? undefined : this.byRendererIndex.get(hit.index)) ?? (hit.serial === undefined ? undefined : this.byRendererSerial.get(hit.serial));
    if (!ref || ref.molecularRevision !== this.molecularRevision || ref.structureId !== this.structureId) return null;
    return { schemaVersion: 1, pickId: pickId(this.generation, hit.index ?? hit.serial ?? 0), pickKind: "ATOM", atomRef: ref, structureId: ref.structureId, molecularRevision: ref.molecularRevision, rendererGeneration: this.generation, coordinateContext: ref.coordinateContext, provenance: "renderer-reverse-identity-map" };
  }

  resolveBond(bond: CanonicalBond, structure: CanonicalMolecularStructure): BondPickResult | null {
    if (structure.id !== this.structureId || structure.scientificHash !== this.molecularRevision) return null;
    const ref1 = this.byStableId.get(bond.atom1);
    const ref2 = this.byStableId.get(bond.atom2);
    if (!ref1 || !ref2) return null;
    const bondRef: StableBondRef = { structureId: structure.id, bondId: bond.id, endpoints: [bond.atom1, bond.atom2], molecularRevision: structure.scientificHash, coordinateContext: coordinateContextFor(structure) };
    return { schemaVersion: 1, pickId: `pick:${this.generation}:bond:${bond.id}`, pickKind: "BOND", bondRef, structureId: structure.id, molecularRevision: structure.scientificHash, rendererGeneration: this.generation, coordinateContext: bondRef.coordinateContext, provenance: "renderer-reverse-identity-map" };
  }

  background(): BackgroundPickResult {
    return { schemaVersion: 1, pickId: pickId(this.generation, 0), pickKind: "BACKGROUND", structureId: this.structureId ?? "", molecularRevision: this.molecularRevision ?? "", rendererGeneration: this.generation, coordinateContext: { coordinateStateId: "none", modelId: this.structureId ?? "", stateId: "none", molecularRevision: this.molecularRevision ?? "" }, provenance: "background-pointer" };
  }

  get generationId(): number { return this.generation; }
}
