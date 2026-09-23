# D2 Implementation Index

## Sealed implementation boundary

- Base: `mole-explorer-docking-d1-accepted-2026-09-19`
- Base SHA: `26227a10416657d0c2518bd0b751a38693627d5b`
- Branch: `feature/docking-d2-explicit-state-site`
- D2 implementation authorization: `ME-DCK-V1-REQ-0281`
- D2 acceptance ledger: 84 rows marked `GATE: D2` in the final acceptance specification

## Production coverage

| D2 subject | Implementation | Evidence |
|---|---|---|
| Contract/provenance substrate | `packages/contracts/src/docking/d2.ts`; `apps/api/src/docking/d2Validation.ts` | canonical typed states, typed statuses, immutable seal result, domain-separated provenance |
| Representation adapters | `apps/api/src/docking/d2Adapters.ts` | SourceArtifact requirement, stable AtomUID/correspondence, PDB/mmCIF/SDF/MOL2 boundaries, SMILES graph-only boundary, PDBQT execution-only boundary |
| Receptor preparation | `apps/api/src/docking/d2Preparation.ts` — `sealPreparedReceptorState` | explicit assembly/model/chains/altloc, chemical state, component roles, dry-water boundary, site-critical and resource validation |
| Ligand preparation | `apps/api/src/docking/d2Preparation.ts` — `sealPreparedLigandState` | one explicit component, explicit ChemicalState/CoordinateState, finite coordinates, stereo/unknown-bond blockers, typing and hard limits |
| Kinematic model | `apps/api/src/docking/d2Preparation.ts` — `sealLigandKinematicModel`; `d2Adapters.ts` PDBQT evidence mapper | exact graph bonds, rigid fragment partition, root, axes/moving sets, ring/restricted/terminal-H guards, separate search/scorer torsion counts |
| SearchRegion/site | `apps/api/src/docking/d2Preparation.ts` — `sealSearchRegion` | exact receptor frame, finite closed AABB, full extents, explicit padding, heavy-atom containment, side/volume limits, no expansion |
| Backend service seam | `apps/api/src/docking/d2PreparationService.ts` | preparation-only service; no scorer/search/optimizer/RMSD/clustering/GPU/HTS/DOCKING.RUN |
| Fixture and acceptance ledger | `apps/api/src/docking/d2FixtureCatalog.ts`; `d2RequirementMatrix.ts` | REC-FX 30, LIG-FX 35, SITE-FX 30, REP-FX catalog, INT-FX-001..010, 84 D2-gated acceptance IDs |

## Explicit non-implementation boundary

The following remain unavailable or deferred by design: automatic pKa/protonation, tautomer enumeration, stereoisomer enumeration, conformer/2D→3D generation, scorer, global/local search, optimizer, RMSD, clustering, native CPU reference kernel, GPU, HTS, and executable `DOCKING.RUN`. Later-gate acceptance rows are recorded in the D2 ledger as boundary/regression evidence and are not claimed as D2 production coverage.

## Focused evidence

- `apps/api/src/docking/d2Preparation.test.ts`: D2 ledger, representation, PDBQT, SMILES, explicit-state, kinematic, SearchRegion and capability checks.
- `verification/docking/d2/03_FIXTURES/D2_FIXTURE_CATALOG.md`: fixture-family inventory and expected outcome categories.
- `verification/docking/d2/00_INITIALIZATION/D2_INITIAL_BASELINE_RUN.md`: clean D1-derived baseline before D2 changes.
