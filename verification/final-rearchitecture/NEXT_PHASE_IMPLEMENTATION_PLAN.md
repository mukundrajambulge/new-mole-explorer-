# Next phase implementation plan

1. Expand the sequence, map, and trajectory corpus and repeat the browser visual gates at the supported size limits.
2. Implement full XTC frame decoding and topology-coordinate pairing; keep XTC metadata-only status visible until then.
3. Re-run ligand context against a real protein-ligand RCSB acquisition and add chemically classified interaction evidence; keep proximity diagnostics separate from interaction typing.
4. Install or provision the pinned executable PyMOL oracle, then run semantic command and selection comparisons. Reconcile the remaining ORACLE_PENDING rows and `super`.
5. Implement measurement and pair-fitting wizards only after their state contracts are specified.
6. Build a separate Movie/States gate for playback, scene interpolation, export, and trajectory performance.
7. Keep docking and HTS outside this campaign until explicitly authorized.
