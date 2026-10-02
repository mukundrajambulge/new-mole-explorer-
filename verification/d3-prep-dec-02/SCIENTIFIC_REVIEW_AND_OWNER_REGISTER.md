# Scientific review and owner decision register

## Status

**No independent scientific review or owner sign-off is evidenced for 3ATL/BEN.** The candidate selection PASS was not preparation approval. This report records a Codex-generated recommendation and does not represent itself as an independent human review.

| Decision / review | Required evidence | Current status | Gate consequence |
|---|---|---|---|
| Candidate identity and development-only purpose | Exact 3ATL/BEN, stated claim and limits | Candidate identity verified; formal owner acceptance of this replacement candidate absent | No scientific authorization |
| Structural biology review | Dated review of mature construct, source and assembly, termini, disulfides, water network, Ca, DMSO, coordinate integrity and proposed component roles | NOT OBTAINED; no reviewer name supplied | Pending; candidate already rejected for the approved water boundary |
| Computational chemistry review | Dated review of BEN protonation/resonance/mapping, receptor microstates, H policy, XS typing, torsion semantics, scorer compatibility and toolchain | NOT OBTAINED; no reviewer name supplied | Pending; no ChemicalState or preparation profile |
| Accountable project owner | Explicit approve/reject of exact candidate and exact state/profile after independent reviews | NOT OBTAINED; no approval signature or dated decision found | No execution authorization |
| Development cohort governance | Development-only label, ownership, prohibited claims, non-holdout status | User task defines intended narrow development purpose; current owner acceptance absent | No validation or benchmark claim |
| Preparation-execution gate | Separate later authorization after profile and approvals | NOT AUTHORIZED | No D3_PREP_EXEC_02_PROMPT.md |

## Structural-biology review package

The reviewer should assess the source and construct reconciliation in SOURCE_AND_CONSTRUCT_RECONCILIATION.md and the component and water records in WATER_NETWORK_AUDIT.md and COMPONENT_DISPOSITION.md. The key decision is whether a water-dependent benzamidine recognition state can be represented by the currently approved receptor profile. The current record indicates that it cannot. The reviewer should also confirm the UniProt alignment, mature termini, six disulfide pairs, and the no-silent-removal policy for Ca and each DMSO molecule.

No person has been assigned or contacted by this gate. Approval must include the reviewer's identity, qualifications/role, date, exact evidence revision reviewed, decision, and any dissent.

## Computational-chemistry review package

The reviewer should assess BEN_CHEMICAL_STATE_REVIEW.md and RECEPTOR_STATE_AND_HYDROGEN_POLICY.md. The central state question is the likely amidinium +1 protomer versus the neutral deposited CCD depiction, including explicit atom mapping, resonance/bond orders, hydrogen placement, donor/acceptor typing, and charge provenance. The reviewer must not infer an approved state from pH or pKa alone. They must assess protonatable receptor groups and hydrogen orientation near the pocket, the D3 typing rules, the exact torsion and Vina N_tors semantics, and whether any reproducible preparation toolchain/profile is validated.

No person has been assigned or contacted by this gate. Approval must include the reviewer's identity, qualifications/role, date, exact evidence revision reviewed, decision, and any dissent.

## Owner record

The current D3-RA-01 owner decision package places 3ATL/BEN in a later water/component stress role rather than as the simple dry-core backup. D3-PREP-CAND-02 subsequently selected it for a dedicated review gate only. No later owner decision approving 3ATL preparation was found in the current canonical material.

Current owner state: **not approved for preparation; no execution authorization.** No approval has been fabricated. The scientifically recommended disposition is candidate rejection for the current ordinary V1 profile and a fresh candidate-selection decision. Any owner response must be appended with date, exact decision, rationale, and scope; this report must not be silently edited to imply approval.

## References

- [D3-RA-01 owner decision package](https://drive.google.com/file/d/1uhmIeWjSMKaihqAySqzK8oVQnZLHn6xC/view)
- [D3-DEC-02 owner decision](https://docs.google.com/document/d/16tF0edL-qg1QYvYC8m3GcnJVrI_X2SS3VSGxNPRjljA/edit)
- verification/d3-prep-cand-02/D3_PREP_CAND_02_REPORT.md
