# 9I7O source-audit reconciliation reference

9I7O/RTL remains `REJECTED_FOR_CURRENT_CORE_DRY_V1_PREPARATION_PATH`. It was not reopened, repaired, or evaluated as a new candidate in this task.

The controlling correction is `verification/d3-prep-dec-03-9i7o/SOURCE_AUDIT_RECONCILIATION.md`: the deposited entity has 178 residues; positions 179–180 are outside that sequence and are not missing; Ile178 is modeled; the genuine sequence gaps are positions 1–17 and 127–130. The earlier cohort matrix is preserved byte-for-byte and must not be used to repeat the false 179–180 claim.

The controlling rejection remains the latest D3-PREP-DEC-03 decision: seven partial receptor sidechains omit 21 heavy atoms; LEU103 and ASN104 are near RTL; the missing mature Leu17 and AEPE loop have unresolved construct/coordinate-state semantics; there is no validated heavy-atom repair profile; and pH/toolchain authorization is still absent. Those are sufficient to exclude 9I7O from the first clean full-pose fixture. No missing atom or residue was rebuilt.

The current RCSB copy retained under `source_artifacts/current_rcsb/9I7O.*` is a provenance copy only. It was not included in the new candidate matrix or used to reopen the decision. The exact reconciliation source and prior audit remain in the predecessor lane cited above.
