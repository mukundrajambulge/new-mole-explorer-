# Heavy-atom invariance contract

## Comparison domain

Freeze the expected selected heavy-atom multiset before any H-generation call. Use source identity fields and stable AtomUIDs, not display names alone:

- receptor: 3DMX model 1, assembly 1 monomer A1, polymer entity 1, chain/asym A, all 164 source residues; common blank atoms plus selected A atoms at MET106/GLU108;
- ligand: the six deposited BNZ source atoms C1–C6 from the selected ligand occurrence;
- exclusions: explicitly classified waters, additives, ions, and source BNZ from the receptor graph are authorized role-based exclusions under ALTERNATE_COMPONENT_POLICY_FREEZE.md. All excluded source rows remain in immutable source evidence and disposition output.

Expected identity tuple is source artifact SHA-256, model, assembly instance, label/auth chain, label/auth residue identifier, insertion code if present, component ID, atom name, element, altloc label, source occurrence/row ID, occupancy, and stable AtomUID. Resolve duplicate source identities as an error; do not silently deduplicate.

## Required checks

1. Before H addition, the selected source graph has the exact expected heavy-atom identities and mapping.
2. Immediately after RDKit AddHs, the heavy-atom identity multiset, AtomUID mapping, heavy-heavy bonds and coordinate binary64 bit patterns are unchanged. Coordinate delta must be exactly zero in memory.
3. Only hydrogen additions explicitly listed by the ChemicalState and parent mapping are permitted. No heavy-atom addition or deletion is permitted inside the selected representation. Source components excluded by named profile roles are reported separately and are not counted as unauthorized deletions.
4. After serialization and independent parse-back, every selected heavy atom must map one-to-one to its exact source AtomUID and each coordinate must be within 0.001 Å Euclidean distance solely to allow decimal serialization/parsing. The output retains the original source coordinate tokens/bytes for source records; the tolerance is not a coordinate movement allowance.
5. Report unauthorized heavy-atom additions, deletions, and coordinate changes as counts. Required result: 0 unauthorized heavy-atom additions; 0 unauthorized heavy-atom deletions; 0 unauthorized heavy-atom coordinate changes. Any count above zero, duplicate identity, missing mapping, or H parent ambiguity invalidates the result and stops the run.

## No tolerance as permission

Before/after in-memory comparison is bitwise exact, so no tolerance applies to the tool call. The 0.001 Å tolerance applies only to an independent file round-trip check. It cannot authorize minimization, coordinate repair, numerical relaxation, or deliberate movement smaller than the threshold. The source bytes and exact source coordinates remain authoritative. A run may not replace original heavy coordinates with rounded output coordinates.

## Evidence retained

Store the expected heavy manifest, before/after identity and coordinate-bit tables, parser version, serialization format/version, maximum per-axis and Euclidean serialization deltas, mismatch details, excluded-component ledger, and signed-off result status. Preserve failure reports and outputs; do not rerun over or erase an earlier failure.
