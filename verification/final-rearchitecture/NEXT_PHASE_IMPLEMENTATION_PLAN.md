# Next phase implementation plan

1. Add distinct sequence viewers for FASTA/FASTQ and validated adapters for GenBank/EMBL.
2. Add map/density viewers for MRC/CCP4/DX with a corpus-backed rendering gate.
3. Define trajectory/topology architecture and performance limits before admitting DCD/XTC/TRR/GRO/PSF/PRMTOP.
4. Re-run ligand context against a real protein-ligand RCSB acquisition and add chemically classified interaction evidence; keep proximity diagnostics separate from interaction typing.
5. Install or provision the pinned executable PyMOL oracle, then run semantic command and selection comparisons. Reconcile the remaining ORACLE_PENDING rows and `super`.
6. Implement measurement and pair-fitting wizards only after their state contracts are specified.
7. Build a separate Movie/States gate for playback, scene interpolation, export, and trajectory performance.
8. Keep docking and HTS outside this campaign until explicitly authorized.
