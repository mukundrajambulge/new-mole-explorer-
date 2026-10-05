# Final Provenance Audit

## Lineage

The tested chain is source artifacts → explicit molecular/receptor identity and source coordinates → chemical state → preparation profile and generated-hydrogen provenance → D2 prepared receptor/ligand seals → typing/scoring profile and assignments → sealed SearchRegion → scoring-field logical/storage digests → per-pose direct and grid decomposition → recomputed numerical summaries → final D3 decision.

No undocumented manual scientific transformation was found. The full-pose bundle records shared receptor, ligand, coordinate-state, SearchRegion, typing, scoring, chemistry, numeric-backend and torsion profile digests; every pose carries its transformed-pose specification and source/pose digests.

## Source bytes and replay

The checked-out `3DMX.cif` and `BNZ.cif` bytes match the pinned SHA-256 values `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef` and `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61`. Both preparation runs recorded these exact hashes and produced the same canonical payload digest. The independent canonical-CBOR replay report matches every recorded D2 digest.

The closure package lists 190 SHA-256 entries. A fresh worktree check matched 185 files byte-for-byte. The remaining five text files match their manifest SHA-256 exactly after reversing only Git/Windows line-ending normalization (`core.autocrlf=true`); no normalized content mismatch remains. The five paths are `SEALED_PREPARATION_RUN_INPUTS.json`, `fullpose/results/FULLPOSE_PER_POSE_RESULTS.csv`, `fullpose/results/FULLPOSE_POSE_MANIFEST.csv`, `fullpose/results/FULLPOSE_TERM_DECOMPOSITION.csv`, and `tools/seal_3dmx_bnz_states.ts`. This distinction is retained: 185 checkout bytes match directly; 5 require canonical line-ending restoration for raw-byte hash comparison.

## Identity-contract exception

The audit also found the mandatory AT-0058 gap. Prepared-receptor state digest inputs omit downstream typing/scoring parameterization references even though these references affect the separately sealed field identity. This is the exact provenance/identity requirement that causes the final HOLD.
