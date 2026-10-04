# Hydrogen provenance report

**Status: PASS for the prepared fixture.**

The authorized RDKit 2026.03.6 hydrogen-only operation generated 1,330 receptor hydrogens and 6 ligand hydrogens from the explicit v1.1 state graphs. Each generated hydrogen is recorded against its parent atom and stable AtomUID in the two per-run provenance manifests. Replay runs produced the same scientific payload and hydrogen provenance digest: sha256:f578e9a683a2fead15f28b4dc415d7b8b29e8f54e65fdc6172feda55bd709c06.

No query atom or query bond was accepted; no implicit chemical-state choice or geometry optimization occurred. Heavy atoms and heavy-heavy bonds were unchanged. Per-run evidence is prepared_states/run-1/HYDROGEN_PROVENANCE.json and prepared_states/run-2/HYDROGEN_PROVENANCE.json.
