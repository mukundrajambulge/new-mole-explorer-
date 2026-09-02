import type { CanonicalBond, CanonicalMolecularStructure } from "@molecular/contracts";

export type CoordinateContext = {
  coordinateStateId: string;
  modelId: string;
  stateId: string;
  molecularRevision: string;
};

export type StableAtomRef = {
  structureId: string;
  objectId?: string;
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

export const coordinateContextFor = (structure: CanonicalMolecularStructure, objectId = structure.id, stateId = "active"): CoordinateContext => ({
  coordinateStateId: `${objectId}:coordinates:${stateId}`,
  modelId: objectId,
  stateId,
  molecularRevision: structure.scientificHash,
});

const pickId = (generation: number, serial: number) => `pick:${generation}:${serial}`;

export class ReverseIdentityMap {
  private readonly byRendererIndex = new Map<number, StableAtomRef>();
  private readonly byStableId = new Map<string, StableAtomRef>();
  private readonly byObjectAndStableId = new Map<string, StableAtomRef>();
  private readonly ambiguousStableIds = new Set<string>();
  private readonly byRendererSerial = new Map<number, StableAtomRef>();
  private readonly ambiguousSerials = new Set<number>();
  private structureId: string | null = null;
  private molecularRevision: string | null = null;
  private generation = 0;

  build(structure: CanonicalMolecularStructure, generation: number): void {
    this.buildMany([{ structure, objectId: structure.id }], generation);
  }

  buildMany(entries: readonly { structure: CanonicalMolecularStructure; objectId: string; stateId?: string }[], generation: number): void {
    this.byRendererIndex.clear();
    this.byStableId.clear();
    this.byObjectAndStableId.clear();
    this.ambiguousStableIds.clear();
    this.byRendererSerial.clear();
    this.ambiguousSerials.clear();
    this.structureId = entries.length === 1 ? entries[0]!.structure.id : null;
    this.molecularRevision = entries.length === 1 ? entries[0]!.structure.scientificHash : null;
    this.generation = generation;
    let rendererIndex = 0;
    for (const entry of entries) {
      const coordinateContext = coordinateContextFor(entry.structure, entry.objectId, entry.stateId ?? "active");
      entry.structure.atoms.forEach((atom) => {
        const ref: StableAtomRef = { structureId: entry.structure.id, objectId: entry.objectId, stableAtomId: atom.stableId, molecularRevision: entry.structure.scientificHash, coordinateContext };
        this.byRendererIndex.set(rendererIndex++, ref);
        this.byObjectAndStableId.set(`${entry.objectId}\u0000${atom.stableId}`, ref);
        if (this.ambiguousStableIds.has(atom.stableId)) return;
        if (!this.byStableId.has(atom.stableId)) this.byStableId.set(atom.stableId, ref);
        else { this.byStableId.delete(atom.stableId); this.ambiguousStableIds.add(atom.stableId); }
        if (this.ambiguousSerials.has(atom.serial)) return;
        if (!this.byRendererSerial.has(atom.serial)) this.byRendererSerial.set(atom.serial, ref);
        else { this.byRendererSerial.delete(atom.serial); this.ambiguousSerials.add(atom.serial); }
      });
    }
  }

  resolveAtomHit(hit: { index?: number; serial?: number; properties?: Record<string, unknown> }): AtomPickResult | null {
    const stableId = typeof hit.properties?.canonicalStableId === "string" ? hit.properties.canonicalStableId : null;
    const objectId = typeof hit.properties?.canonicalObjectId === "string" ? hit.properties.canonicalObjectId : null;
    const ref = (stableId && objectId ? this.byObjectAndStableId.get(`${objectId}\u0000${stableId}`) : undefined) ?? (stableId ? this.byStableId.get(stableId) : undefined) ?? (hit.index === undefined ? undefined : this.byRendererIndex.get(hit.index)) ?? (hit.serial === undefined ? undefined : this.byRendererSerial.get(hit.serial));
    if (!ref) return null;
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
