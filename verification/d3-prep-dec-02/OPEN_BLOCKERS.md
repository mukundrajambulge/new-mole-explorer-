# D3-PREP-DEC-02 open blockers and next step

## Candidate-level stop

1. **Essential water/profile mismatch — decisive.** The trypsin–benzamidine bound-state evidence includes a ligand-recognition W1 bridge and an Asp189 water reservoir. CORE_DRY_V1 has no explicit scoring water; PHD-V2-08 classifies required bridge/conserved site water as unsupported and no fixed-water profile is approved. Deleting site waters to fit dry V1 is not scientifically authorized. Disposition: reject 3ATL/BEN for this fixture.

## Additional unclosed items

2. **BEN ChemicalState.** CCD BEN is neutral C7H8N2 without observed coordinate hydrogens. +1 amidinium is strongly favored by bulk pH/pKa inference, but bound-state formal charge, resonance/bond-order convention, atom mapping and hydrogens are not approved.
3. **Receptor microscopic state.** Histidine, acidic/basic side-chain and mature N-terminal Ile states are not resolved by crystal-growth pH. Hydrogen orientations and preparation policy are not approved.
4. **Toolchain.** No approved deterministic preparer, version/hash, environment, settings, or validated profile exists. Meeko 0.8.0 is reference-only; automatic protonation methods remain experimental/unvalidated.
5. **Calcium and DMSO component policy.** Calcium is coordinated but distal; DMSO instances are distal. Exclusion still needs explicit biological-role/provenance documentation and scorer-derived site-influence assessment.
6. **Independent scientific review and owner approval.** Neither structural-biology review, computational-chemistry review, nor exact owner authorization is recorded.
7. **No prepared pair.** No PreparedReceptorState, PreparedLigandState, SearchRegion, shared scientific digest, or D2-sealed fixture exists.

## Required disposition

Return to a new fixture-search decision. Start with the current CORE_DRY_V1 scientific boundaries and current owner decision record. Do not automatically promote 181L/BNZ; its earlier authorization gate remains HOLD for construct and terminal-state ambiguity. Select a candidate only after the owner confirms the intended fixture role. A future authorization gate must close every applicable state, water/component, toolchain, provenance, independent-review, and owner field before any preparation is separately authorized.

Full D3 remains HOLD, D4 remains BLOCKED, and DOCKING.RUN remains unavailable.
