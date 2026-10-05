# D3 3DMX/BNZ Fixture Evidence Freeze

The reviewed full-pose evidence uses the active D3 development fixture `3DMX / BNZ`. It is one bounded development fixture, not a benchmark population.

## Source and preparation

- Source receptor: official RCSB 3DMX mmCIF, SHA-256 `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef`.
- Ligand: official CCD BNZ mmCIF, SHA-256 `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61`.
- Profile: `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1` (1.1.0), pinned CPython 3.13.16, RDKit 2026.03.6, WSL2 Ubuntu 24.04.5 x86-64.
- Corrected altloc groups: ASN68 A (0.70), ASP72 A (0.80), ARG76 A (0.60), MET106 A (0.70), GLU108 A (0.70), each selected coherently with common blank-altloc atoms. ASN68 remains neutral CCD Asn; ASP72 remains deprotonated; ARG76 remains protonated. GLU128 is deprotonated.
- Component dispositions: 418/418 occurrences accounted for; dry-core scoring excludes 248 water occurrences. 164/164 residues, 51/51 state-sensitive side chains, both termini, and all altloc groups are dispositioned.
- Hydrogen-only preparation generated 1,330 receptor and 6 ligand hydrogens. No heavy atom was added, deleted, remapped, moved, flipped, repaired or renamed.

## Seals and replay

- Canonical prepared scientific payload, both runs: `sha256:212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`.
- PreparedReceptorState: `sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06`.
- PreparedLigandState: `sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1`.
- SearchRegion: `sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d`.
- Receptor/ligand coordinate-state digests: `sha256:7326d80384638649b8ba28664988b9332c276ca859d7e85d936cb0620b9e1f94` / `sha256:6867f7bdf67192bcf16ccd11e730a61a7deb2d1e83eae5f13fd16249a8dcac95`.
- Independent canonical-CBOR replay recomputed the D2 identity, graph, chemical, coordinate, kinematic, prepared-state and SearchRegion digests. Heavy-atom invariant counts are all zero; serialization displacement is 0.0 Å.

Raw source artifacts, full preparation outputs and all seal inputs remain in `verification/d3-closure-exec-01/`. The fixture evidence passes; it does not close the separate AT-0058 contract defect.
