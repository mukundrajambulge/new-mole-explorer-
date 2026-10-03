# Open blockers — D3-PREP-AUTH-04

## Blocks preparation execution

1. **AUTH04-01 owner bootstrap decision:** no current record permits this one 3DMX/BNZ bootstrap before the later prepared-state/full-pose prerequisite.
2. **AUTH04-02 owner state/context decision:** no owner approval accepts or replaces the pH 6.9 crystallization-context proxy and exact receptor residue/terminus state map.
3. **AUTH04-03 owner profile/toolchain decision:** no owner approval accepts the named RDKit profile, hydrogen-only method, component/altloc interpretation, or exact dependency stack.
4. **Per-site enumeration conflict within DEC04:** its prose reports 49 ionizable side-chain groups, its CSV groups to 51 distinct side-chain residue identities plus the two termini, and the numbered state list omits source-audited GLU128. AUTH04-02 asks the owner to confirm the exact 51-site set and GLU128− inclusion. No per-residue preparation is permitted until that answer is explicit.

Each question has exact YES/NO consequences in OWNER_DECISION_PACKET.md. Do not infer approval from task initiation or from existing approvals of Architecture B, fixture selection, or D2 contracts.

## Run-time fail-closed preconditions after approval

These are execution checks, not open scientific decisions:

- exact source hashes and selected atom rows match the predecessor source manifest;
- approved profile and explicit state map are provided without hidden defaults;
- driver source and configuration are sealed and hashed before the first AddHs call;
- graph completeness, atom mapping, polymer connectivity, altloc coherence, and component-role checks all pass;
- exact CPython/RDKit/dependency wheels and hashes verify in the offline environment;
- all H additions have one exact parent AtomUID and expected atom inventory;
- heavy-atom bitwise equality and serialization-only round-trip checks pass;
- run provenance and all output digests are produced without changing the source.

Any violation aborts before or during the tool operation with preserved diagnostics. A failed check is not overridable under this proposal.

## Not blockers

No independent structural-biologist/computational-chemist approval is required before preparation by the canonical PHD-V2 preparation rules reviewed; it is recommended. General independent evidence review at gate closure and final D3 scientific qualification review remain separate requirements. The absence of a prepared-state digest in this lane is correct because no prepared state exists.

## Preserved gate status

3DMX/BNZ remains the active selected fixture. D3-FIXTURE-READY-03 remains PASS. D3-PREP-DEC-04 remains HOLD for authorization. D3-PREP-EXEC-04 remains NOT AUTHORIZED. Full D3 remains HOLD. D4 remains BLOCKED. DOCKING.RUN remains UNAVAILABLE.
