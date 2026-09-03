import type { CanonicalMolecularStructure } from "@molecular/contracts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/**
 * Partial charges are scientific data, not a renderer convenience. Every
 * consumer must require the same complete, revision-bound dataset contract.
 */
export const canonicalPartialChargeDatasetComplete = (structure: CanonicalMolecularStructure): boolean => {
  const dataset = structure.partialChargeDataset;
  if (!dataset || dataset.molecularRevision !== structure.scientificHash) return false;
  if (!nonEmpty(dataset.datasetId) || !nonEmpty(dataset.chargeModel) || !nonEmpty(dataset.profileVersion) || !nonEmpty(dataset.units) || !nonEmpty(dataset.provenance)) return false;
  if (!isRecord(dataset.atomChargeMap)) return false;
  const atomIds = new Set(structure.atoms.map((atom) => atom.stableId));
  const entries = Object.entries(dataset.atomChargeMap);
  return atomIds.size > 0
    && entries.length === atomIds.size
    && structure.atoms.every((atom) => {
      const value = dataset.atomChargeMap[atom.stableId];
      return typeof value === "number" && Number.isFinite(value);
    })
    && entries.every(([atomId, value]) => atomIds.has(atomId) && typeof value === "number" && Number.isFinite(value));
};

/** Complete, revision-bound donor/acceptor role assignments with provenance. */
export const canonicalChemistryRolesDatasetComplete = (structure: CanonicalMolecularStructure): boolean => {
  const dataset = structure.chemistryDataset;
  if (!dataset || dataset.molecularRevision !== structure.scientificHash || dataset.profileVersion !== "canonical-chemistry-roles-v1") return false;
  if (!nonEmpty(dataset.datasetId) || !nonEmpty(dataset.provenance)) return false;
  if (!Array.isArray(dataset.donorAtomIds) || !Array.isArray(dataset.acceptorAtomIds)) return false;
  const atomIds = new Set(structure.atoms.map((atom) => atom.stableId));
  return [...dataset.donorAtomIds, ...dataset.acceptorAtomIds].every((atomId) => typeof atomId === "string" && atomIds.has(atomId));
};

/** Complete, revision-bound fragment memberships with provenance. */
export const canonicalFragmentDatasetComplete = (structure: CanonicalMolecularStructure): boolean => {
  const dataset = structure.fragmentDataset;
  if (!dataset || dataset.molecularRevision !== structure.scientificHash || dataset.profileVersion !== "canonical-fragment-assignment-v1") return false;
  if (!nonEmpty(dataset.datasetId) || !nonEmpty(dataset.assignmentSource) || !nonEmpty(dataset.provenance)) return false;
  if (!isRecord(dataset.atomFragmentMap)) return false;
  const atomIds = structure.atoms.map((atom) => atom.stableId);
  return atomIds.length > 0
    && atomIds.every((atomId) => typeof dataset.atomFragmentMap[atomId] === "string" && dataset.atomFragmentMap[atomId]!.trim().length > 0)
    && Object.keys(dataset.atomFragmentMap).every((atomId) => atomIds.includes(atomId));
};
