# D3-FINAL-01 handoff

**Status: NOT READY.** D3-CLOSURE-EXEC-01 remains on HOLD because the hash-verified 3DMX source contains three A/B alternate-location groups (ASN68, ASP72, ARG76) outside the two groups resolved by the frozen owner-approved profile (MET106, GLU108). The approved runtime relocation succeeded, but its authorization explicitly did not change the alternate policy. The source preflight stopped before a fixture receptor graph was accepted or a fixture molecule was supplied to RDKit.

The Linux runtime reports CPython 3.13.16 and RDKit 2026.03.6 and successfully imports the required `rdkit.Chem` APIs. The pinned Linux wheel SHA-256 is `3d0a2011c2a46f312010c8d8ec89b8210795663285545b2ac0909d1b9551fe41`; package-builder provenance is stated in `LINUX_RUNTIME_RECORD.md`. Platform review passed for bounded AddHs API semantics, not binary or cross-platform hydrogen-coordinate equivalence. Synthetic ethane and aromatic controls each passed twice with matching within-platform signatures.

All six frozen source artifacts passed Windows-versus-WSL SHA-256 and byte-length comparison. These checks establish byte identity and safe parser input, not a prepared fixture state. No fixture preparation, hydrogen provenance report, heavy-atom invariant, prepared-state digest, SearchRegion, replay, full-pose cohort, score statistics, or fixture-specific resource result exists. Therefore D3-FINAL-01 cannot make the final accept/reject decision from this package.

The exact unresolved owner decision was requested: extend the current fixture profile to select coherent maximum-occupancy A at ASN68, ASP72, and ARG76, or preserve the current authorization. The existing one-fixture bootstrap remains unconsumed. Do not infer approval, mutate the profile, or start dependent chemistry work before that response.

Predecessor code review, blocked-state evidence review, and software regression results remain preserved. No application scoring/capability code changed in this continuation, so the earlier 47-file/254-test regression is not recast as a failure or represented as rerun.

The Windows Application Control failure remains in the record as the reason for relocation; it is no longer the active runtime issue. No security policy was changed. D4 remains blocked and `DOCKING.RUN` unavailable. Continue only within the same D3-CLOSURE-EXEC-01 objective after the owner resolves the exact coordinate-state mismatch; do not create another D3 stage.
