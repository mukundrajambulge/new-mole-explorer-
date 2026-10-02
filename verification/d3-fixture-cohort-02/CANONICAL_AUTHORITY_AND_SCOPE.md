# Canonical authority and gate scope

## Controlling project state

- Project: Mole Explorer, the molecular workstation in this repository.
- Source of Truth: D3 molecular workstation SOT, version 1.2, Google Doc ID `1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk`.
- Roadmap: D3 implementation roadmap, version 1.2, Google Doc ID `1YDNaYI9xe9l3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU`.
- Required predecessor: `fc687c5aebab248cf8f0a58631b6cfe78420d30c`; source strategy: `verification/d3-4w52-src-01/NEXT_FIXTURE_STRATEGY.md`.

The current SOT and roadmap name reference scoring as the next docking gate. Full D3 remains on HOLD, D4 remains BLOCKED, and `DOCKING.RUN` remains unavailable. This cohort review authorizes no preparation operation. Its only proposed next action is a candidate-specific `D3_PREP_DEC_03` authorization decision.

## Applicable standards

- PHD-V2-03: receptor identity and assembly must be explicit (`ASYMMETRIC_UNIT`, deposited biological assembly, or explicit instance set); assess missing residues and binding-site relevance; keep alternate conformations coherent.
- PHD-V2-06: use the canonical 16 atom types without generic fallbacks. The `RTL` CCD graph resolves retinol to 19 `C_H`, one `C_P` (the carbon bonded to oxygen), and one `O_DA`; each is supported by the canonical type set.
- PHD-V2-08 and the SOT: distinguish representation, preparation/typeability, scorability, searchability, and validation. A source-resolved structure does not grant the later states.
- CORE_DRY_V1 excludes waters and does not represent unsupported metal coordination or cofactors. Water exclusion is admissible only when the source and literature review do not require a water-supported ligand state.

## Scope boundary

This is source and coordinate evidence review only. No protonation, hydrogen addition, rebuilding, minimization, PDBQT generation, receptor production state, direct grid, scoring, docking, water support, scorer changes, D4 work, or production-lane changes were made. No preparation prompt in this package is an execution request; it asks for a later authorization decision.

## Final status

**D3-FIXTURE-COHORT-02 PASS — SOURCE-RESOLVED CORE_DRY_V1 FIXTURE SELECTED**

Candidate: PDB `9I7O`, deposited asymmetric-unit chain A with its deposited author-designated monomer assembly context. The candidate-specific authorization prompt carries the mixed natural variant, coordinate gaps, water boundary, and crystallization-pH metadata discrepancy forward. Overall gate status remains D3 HOLD, D4 BLOCKED, and `DOCKING.RUN` unavailable.
