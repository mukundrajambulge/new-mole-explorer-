# D3-SCI-04 — Sparse Grid Semantics and C++ Resource Proof

**Disposition: research evidence passed; D3 remains HOLD.** This report records the bounded test-only evidence authorized for D3-SCI-04. The approved 59-array direction is conditional; this report does not accept the final physical representation.

## Scope and source state

- Worktree: `C:\Users\mukun\.codex\worktrees\d3-sci04-proof\molecular-workstation`
- Direct-scoring oracle: preserved D3-TOR-01 commit `f0bd2eaf47b02faab4dea694e7c2677094969076`.
- No production scoring, grid, interpolation, search, pose-generation, or molecular-preparation code was added. No canonical document or accepted source was changed.
- The runner requires the pinned scorer commit and a clean native scoring directory. It verifies Zig version/executable/package hashes and records the direct scorer source hash.
- The evidence is scoped to the owner-approved direction: 16 XS types and 80 stable logical channels, with 59 candidate physical arrays only for equation-proven exact zeros.

## Logical and physical channel map

The 16 canonical XS types are ordered `C_H, C_P, N_P, N_D, N_A, N_DA, O_P, O_D, O_A, O_DA, S_P, P_P, F_H, Cl_H, Br_H, I_H`. Term IDs are `G1=0, G2=1, REP=2, HYD=3, HB=4`. The harness asserts `channel = 5 × XS_ID + TERM_ID` for all 80 channels; physical storage does not renumber them.

The candidate physical map retains all G1/G2/REP channels, HYD IDs `3, 63, 68, 73, 78`, and HB IDs `19, 24, 29, 39, 44, 49`. It omits 11 HYD channels (`8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58`) for ligand types without the hydrophobic role, and 10 HB channels (`4, 9, 14, 34, 54, 59, 64, 69, 74, 79`) for ligand types with neither donor nor acceptor role. The detailed ordered map is in [channel-map.json](channel-map.json).

## Exact-zero and binary64 evidence

The C++ proof compiles the unchanged direct scorer and checks all 256 receptor/ligand type pairs at five surface distances (1,280 pair-distance cases). Its independent XS capability table must match the scorer's capability functions. The omitted HYD channels receive 880 raw-zero checks; omitted HB channels receive 800. The raw omitted value is bit-exact binary64 `+0.0` (`0000000000000000`). The native scorer's ordinary negative weighting yields bit-exact `-0.0` (`8000000000000000`) for the exercised HYD and HB cases.

The proof establishes the zero-role gate against the preserved direct equations. It does not test a production grid builder, grid-node generation, interpolation, or full-pose scoring. It infers no tolerance around term or cutoff boundaries.

## Serialization, logical digest, and cache evidence

The TypeScript fixtures call the existing `ME_CANONICAL_CBOR_V1_1_0` encoder/decoder and `F64Bits` implementation and use the PHD-V2-10 digest envelope. A four-point-per-channel synthetic vector expands omitted channels as binary64 `+0.0`. Dense and expanded sparse logical CBOR are byte-identical and produce the same logical digest:

`sha256:bdf9224d8f1aba094bccbe1e163176a08ecc7be8fdd57311a2d6e0266cbb3685`

Distinct research-only physical schema IDs produce distinct physical identities and cache keys. The fixture allows same-schema reuse and rejects cross-schema reuse. The schema labels and `SCORING_FIELD_STORAGE_V1` payload are proposals used by this harness, not normative schemas. Signed zero survives CBOR round-trip and remains digest-distinct. There is no production ScoringField serializer, logical digest, physical-storage identity, or cache implementation to accept yet. The vector covers 320 sample values, not a full serialized field.

## Full-size C++ resource model

The C++ model allocates and touches 59 arrays at 110³ = 1,331,000 points, plus candidate metadata, descriptors, axes, 250,000 receptor atom records, 50,000 residue descriptors, a spatial-tree/order model, and eight worker scratch slots.

| Measure | Result | Existing limit | Model result |
|---|---:|---:|---|
| Raw field payload | 628,232,000 B (599.13 MiB) | 768 MiB | Pass |
| Total field-owned requested allocations | 674,904,616 B (643.64 MiB) | 1 GiB | Pass |
| Peak process working set | 681,725,952 B (650.14 MiB) | 2 GiB default per attempt | Pass |
| Peak process working set | 681,725,952 B (650.14 MiB) | 4 GiB ordinary-V1 ceiling | Pass |

This is a C++ allocation/build model, not a production ScoringField. The arrays are populated with synthetic constants; the BVH and scratch are explicit candidate layouts. Field-owned allocation totals count requested PMR bytes and exclude allocator bookkeeping and process/runtime allocations. `model_construction_seconds` times this model only. These results do not close the final 59-array resource condition; the eventual production layout must be measured at full size.

## Run record and review

- Compiler: Zig C++ 0.16.0, target `x86_64-windows-gnu`; floating-point flags `-ffp-contract=off -fno-fast-math`.
- Provenance: scorer source SHA-256 `4e376af7c1e6da4b5404678a138b05ff032ca9fef7b6d8040e3b263437ba55ec`; compiler executable SHA-256 `086ce9d47ba42f33a514e1a6e04eb1d4a8fa1d75e0868e0213caad447c91e864`; verified portable package SHA-256 `68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e`.
- Test runner: repository-lockfile Vitest 2.1.9.
- Result: native zero proof passed; resource model returned `PASS_FOR_RESEARCH_MODEL`; all 7 serialization/channel/cache conformance tests passed. The latest repeat measured a 681,725,952-byte peak working set; RSS varies slightly between process runs.
- Independent read-only review found no correctness defect in the proposed map or zero proof. It confirmed that synthetic serialization and resource fixtures support this bounded research stage only.

Machine-readable details are in [direct-scorer-proof.json](evidence/direct-scorer-proof.json), [serialization-proof.json](evidence/serialization-proof.json), [resource-model.json](evidence/resource-model.json), and [run-manifest.json](evidence/run-manifest.json). Harness sources are in this directory.

## Normative follow-up map

No source-of-truth amendment was made in this stage. A controlled owner-approved update should:

- reconcile PHD-V2-13, REQ-0103, AT-0103, and PHD-V2-15 GAP-007 from the stale 14-type/70-channel wording to 80 stable logical channels and the conditional 59-array physical proposal, while preserving all four resource limits;
- keep PHD-V2-06's canonical chemistry and exact scoring equations as the basis for the zero proof and state the resulting ordered channel map;
- define the logical `ScoringFieldDigest` independently from a separately versioned physical-storage identity/schema in PHD-V2-10, including omitted-channel `+0.0`, weighted signed zero, and cache compatibility;
- update Roadmap and Source of Truth traceability to record D3-SCI-04 evidence while retaining D3 HOLD and D4 BLOCKED;
- leave PHD-V2-11 direct-versus-grid acceptance limits, ranking thresholds, and preparation profiles unset until the separately required prepared-state/full-pose development evidence and owner decision.

## Gate state

D3 remains HOLD. D4 remains BLOCKED. Production `DOCKING.RUN` remains unavailable. No automatic preparation occurred; no 181L or 3ATL state was prepared; no search, pose generation, or production grid implementation was authorized or performed. The exact-zero, serialization, digest, cache, and resource outputs here are research evidence for the next owner review, not final physical-storage acceptance.
