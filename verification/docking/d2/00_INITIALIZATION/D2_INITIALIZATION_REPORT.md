# D2 Initialization Report

## Repository and sealed starting point

- **REPOSITORY:** `new-mole-explorer-` (`https://github.com/mukundrajambulge/new-mole-explorer-.git`)
- **D1 TAG:** `mole-explorer-docking-d1-accepted-2026-09-19`
- **D1 SHA:** `26227a10416657d0c2518bd0b751a38693627d5b`
- **CURRENT HEAD:** `26227a10416657d0c2518bd0b751a38693627d5b`
- **WORKTREE:** `C:\Users\mukun\.codex\worktrees\molecular-workstation-d2-explicit-state-site\molecular-workstation`
- **CLEAN/DIRTY:** clean at initialization
- **D2 BRANCH:** `feature/docking-d2-explicit-state-site`
- **EXISTING D2 COMMITS:** none; branch created directly from the accepted D1 tag
- **D1 checkout isolation:** the original dirty checkout and the D1 repair worktree are preserved and are not the D2 workspace

The remote tag dereferences to the exact accepted D1 SHA. The D2 branch was created only after the new worktree was verified detached, exact-tag aligned, and clean. No D2 source code was present before this report.

## Authority read before implementation

The following Drive authorities were read before code changes:

- `PHD-V2 — DOCKING RESEARCH MASTER INDEX`
- `PHD-V2-15 — Integrated Docking Scientific Synthesis, Normalized Requirements & Implementation Authorization — v1.0`
- `PHD-V2 — NORMALIZED DOCKING REQUIREMENTS — v1.0`
- `PHD-V2 — FINAL DOCKING ACCEPTANCE SPECIFICATION — v1.0`
- `PHD-V2 — IMPLEMENTATION HANDOFF`
- `PHD-V2-02` representation/file/identity/PDBQT specification
- `PHD-V2-03` receptor preparation specification
- `PHD-V2-04` ligand preparation/chemical-state/torsion specification
- `PHD-V2-05` SearchRegion/site specification
- `PHD-V2-08` special chemistry and ordinary-V1 capability boundary
- `PHD-V2-10` provenance/replay/hash specification
- `PHD-V2-14` workflow and native-boundary specification
- `IA-09` and `IA-10` implementation architecture specifications
- D1 sealed implementation index, unit report, E2E report, upstream regression report, and negative scope audit

## Authoritative D2 requirement and acceptance surface

The explicit D2 implementation authorization is:

- `ME-DCK-V1-REQ-0281` / `ME-DCK-V1-AT-0281`: D2 implements representation adapters, explicit-state preparation/sealing, and SearchRegion contracts; automatic protonation, tautomer, and conformer generation remains prohibited.

The final acceptance specification marks the following 84 acceptance rows `GATE: D2`. They are retained as the authoritative D2 acceptance ledger, even where an individual row is a later-gate regression/boundary check and therefore must remain fail-closed or deferred in D2:

```text
ME-DCK-V1-AT-0001
ME-DCK-V1-AT-0002
ME-DCK-V1-AT-0004
ME-DCK-V1-AT-0005
ME-DCK-V1-AT-0006
ME-DCK-V1-AT-0007
ME-DCK-V1-AT-0008
ME-DCK-V1-AT-0009
ME-DCK-V1-AT-0011
ME-DCK-V1-AT-0029
ME-DCK-V1-AT-0031
ME-DCK-V1-AT-0032
ME-DCK-V1-AT-0033
ME-DCK-V1-AT-0034
ME-DCK-V1-AT-0035
ME-DCK-V1-AT-0036
ME-DCK-V1-AT-0037
ME-DCK-V1-AT-0038
ME-DCK-V1-AT-0039
ME-DCK-V1-AT-0042
ME-DCK-V1-AT-0044
ME-DCK-V1-AT-0045
ME-DCK-V1-AT-0048
ME-DCK-V1-AT-0049
ME-DCK-V1-AT-0050
ME-DCK-V1-AT-0051
ME-DCK-V1-AT-0053
ME-DCK-V1-AT-0054
ME-DCK-V1-AT-0060
ME-DCK-V1-AT-0061
ME-DCK-V1-AT-0063
ME-DCK-V1-AT-0064
ME-DCK-V1-AT-0065
ME-DCK-V1-AT-0066
ME-DCK-V1-AT-0067
ME-DCK-V1-AT-0069
ME-DCK-V1-AT-0071
ME-DCK-V1-AT-0073
ME-DCK-V1-AT-0074
ME-DCK-V1-AT-0076
ME-DCK-V1-AT-0077
ME-DCK-V1-AT-0078
ME-DCK-V1-AT-0079
ME-DCK-V1-AT-0080
ME-DCK-V1-AT-0081
ME-DCK-V1-AT-0082
ME-DCK-V1-AT-0083
ME-DCK-V1-AT-0087
ME-DCK-V1-AT-0088
ME-DCK-V1-AT-0089
ME-DCK-V1-AT-0090
ME-DCK-V1-AT-0092
ME-DCK-V1-AT-0110
ME-DCK-V1-AT-0111
ME-DCK-V1-AT-0112
ME-DCK-V1-AT-0117
ME-DCK-V1-AT-0118
ME-DCK-V1-AT-0120
ME-DCK-V1-AT-0122
ME-DCK-V1-AT-0127
ME-DCK-V1-AT-0130
ME-DCK-V1-AT-0131
ME-DCK-V1-AT-0133
ME-DCK-V1-AT-0134
ME-DCK-V1-AT-0135
ME-DCK-V1-AT-0136
ME-DCK-V1-AT-0137
ME-DCK-V1-AT-0138
ME-DCK-V1-AT-0140
ME-DCK-V1-AT-0143
ME-DCK-V1-AT-0149
ME-DCK-V1-AT-0203
ME-DCK-V1-AT-0205
ME-DCK-V1-AT-0208
ME-DCK-V1-AT-0214
ME-DCK-V1-AT-0215
ME-DCK-V1-AT-0222
ME-DCK-V1-AT-0255
ME-DCK-V1-AT-0256
ME-DCK-V1-AT-0257
ME-DCK-V1-AT-0272
ME-DCK-V1-AT-0281
ME-DCK-V1-AT-0282
ME-DCK-V1-AT-0290
```

The production implementation subset is the D2-scoped representation, receptor preparation, ligand preparation, kinematic-model, site/SearchRegion, provenance/mapping, and ordinary-V1 capability-boundary work. The D2 acceptance ledger rows for exact scorer/search/RMSD/result/native CPU implementation (`0110–0127`, `0138`, `0143`, `0149`, `0203`, `0205`, `0208`, and `0255–0257`) are acceptance/regression boundaries owned by later gates; D2 must not invent those engines. `AT-0282` is explicitly a D3 authorization statement and `AT-0290` is governance evidence. D2 will record these statuses rather than claim unsupported implementation.

## Mandatory fixture families

- **D1 regression:** `INT-FX-001` through `INT-FX-004`
- **D2 integration:** `INT-FX-005` through `INT-FX-010`
- **Representation:** `REP-FX` family
- **Receptor preparation:** `REC-FX` family, specification count 30
- **Ligand preparation:** `LIG-FX` family, specification count 35
- **SearchRegion/site:** `SITE-FX` family, specification count 30

The D2 integration fixtures are required to cover explicit receptor state selection and ambiguity blocking, explicit ligand ChemicalState/3D CoordinateState sealing, missing stereo/tautomer blocking without auto-enumeration, SMILES-only blocking until mapped explicit 3D exists, and closed-boundary SearchRegion containment including the one-ULP outside case.

## D1 regression baseline

- D1 unit gate: 1 test file, 14 tests passed, 0 failed, 0 skipped.
- D1 normalized requirement mapping: 40 / 40 requirements covered.
- D1 local E2E evidence: 147 passed, 0 failed, 0 skipped.
- Protected upstream selection matrix: 87 rows; 85 verified working, 1 missing dependency, 1 intentionally unsupported.
- Protected R10 regression generation: passed.
- D1 negative audit: no preparation, scoring, search, optimization, RMSD, clustering, GPU, HTS, or fake docking implementation.

The baseline will be rerun from this D2 branch before implementation changes are accepted and again at D2 closure.

## Scope risks and controls

1. **Automatic scientific-state generation creep:** no automatic pKa/protonation, tautomer, stereoisomer, conformer, or 2D-to-3D generation; missing or ambiguous explicit state fails closed.
2. **PDBQT authority inversion:** PDBQT remains derived/imported execution evidence only; it can never become MolecularIdentity or ChemicalState authority.
3. **Viewer-state leakage:** presentation, camera, current object, array index, source serial, and mutable UI state cannot affect scientific identity or sealed hashes.
4. **Ambiguous structural semantics:** assembly, model, chain/operator, altloc, residue/insertion, component role, protonation, and site-critical defects must be explicit and typed.
5. **Kinematic-model drift:** imported ROOT/BRANCH/TORSDOF and generated/validated torsions must map to authoritative AtomUIDs; ring bonds, restricted amides, and terminal-H-only rotations cannot become search torsions.
6. **SearchRegion boundary errors:** use exact receptor-frame Å coordinates, finite canonical min/max, full extents, closed containment, explicit padding, no hidden expansion, and hard side/volume limits.
7. **Parser/input security:** all adapters remain bounded, reject malformed/nonfinite/ambiguous input, and preserve immutable source bytes and provenance.
8. **D1 regression risk:** D1 canonical CBOR/F64Bits/digest, six-state JobStatus, orthogonal statuses, request immutability, and unavailable-command boundaries remain unchanged.
9. **Scope leakage:** no scorer, global/local search, optimizer, RMSD, clustering, GPU, HTS, or `DOCKING.RUN` implementation is permitted in D2.

## Implementation order

1. **D2-A — Contract and provenance substrate:** versioned explicit state schemas, typed diagnostics/outcomes, stable AtomUID/correspondence, adapter/conversion/loss records, domain-separated hashes, and replay-safe provenance.
2. **D2-B — Representation adapters:** bounded PDB/mmCIF/SDF/MOL V2000/MOL2/SMILES/PDBQT interpretation boundaries, preserving source evidence and rejecting unsupported/ambiguous semantics.
3. **D2-C — Receptor preparation/sealing:** explicit assembly/model/altloc/component/chemical state, CORE_DRY_V1 boundary, site-critical defect handling, receptor validation, and immutable PreparedReceptorState.
4. **D2-D — Ligand preparation/sealing:** explicit component/ChemicalState/CoordinateState, no automatic state generation, finite-3D and stereo requirements, explicit atom typing boundary, immutable PreparedLigandState.
5. **D2-E — Kinematic model:** validated explicit rigid fragments, rotatable edges, moving sets, axes, domains/periodicity, root semantics, ring/restricted-bond invariants, and separate search-torsion accounting.
6. **D2-F — SearchRegion/site contracts:** exact receptor-frame AABB, closed containment, reference-ligand envelope/padding, site identity/provenance, hard limits, invalidation, and capability boundaries.
7. **D2-G — Integration and closure:** INT-FX-005..010 plus REP/REC/LIG/SITE fixture campaigns, D1 regression rerun, acceptance matrix, Drive closure/readback, implementation-index update, exact tested D2 tag, and stop before D3.

## Initialization decision

D2 is authorized to begin on this exact clean branch. The first implementation change must remain within D2-A and the scopes above. Any requirement that would require a scorer, search engine, native numerical backend, or executable docking command is a later-gate dependency and must remain explicitly unavailable or deferred.
