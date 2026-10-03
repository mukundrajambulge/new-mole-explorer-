# Open blockers — D3-PREP-DEC-04

1. **Owner governance / timing:** D3-GRID-DEC-02 says preparation profiles remain open for a later owner decision after suitable D2-prepared-state/full-pose evidence. The first 3DMX/BNZ state does not exist yet. A scoped owner amendment is needed before using DEC-04 to bootstrap it.
2. **Candidate receptor chemical state:** the only deposited pH is crystal-growth pH 6.9; ligand-soak/binding pH is not identified. HIS31 has no observed hydrogens and its neutral/positive microstate is unresolved. A source-context proxy pH and explicit residue-state map are proposed but not owner-approved.
3. **Exact preparation toolchain:** no accepted tool/version, container/runtime digest, dependency lock, executable hash, command/options, deterministic hydrogen/orientation behavior, or error policy exists for this candidate. Existing Meeko/PDB2PQR/PROPKA/RDKit research artifacts are not approval.
4. **Hydrogen policy implementation:** exact receptor hydrogen placement, terminal/OH orientation, BNZ H coordinates and atom provenance cannot be frozen until the chemical state and toolchain are approved.
5. **Prepared-state digests:** no `PreparedReceptorState`, `PreparedLigandState`, or SearchRegion digest exists. Do not fabricate placeholders. Source and geometry-only digests are sufficient for this decision record.

Not blockers: source identity/resolution, missing-heavy-atom readiness, BNZ graph/protomer/stereo, coherent major altloc evidence, water/component source inventory, current XS domain support, and the bounded reference-pose grid geometry. These remain `PASS_FOR_DECISION` based on D3-FIXTURE-READY-03 plus the exact source hashes and read-only calculations in this lane.

No reviewer approval is required by the canonical PHD-V2 rules reviewed for this decision. The D3-PREP-DEC-04 task itself says optional review must not create a blocker. The next task is owner decision/profile-lock only; do not repeat fixture discovery unless contradictory authoritative evidence appears.
