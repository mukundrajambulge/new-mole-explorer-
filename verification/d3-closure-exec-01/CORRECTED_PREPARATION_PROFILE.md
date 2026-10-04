# Corrected 3DMX/BNZ preparation profile

**Status:** bounded, owner-authorized profile-completeness amendment; source/profile validator PASS.

## Identity

- Corrected profile ID: `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1`
- Semantic version: `1.1.0`
- Predecessor: `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0` / `1.0.0`
- Schema: `D3_3DMX_BNZ_PREPARATION_PROFILE_V1`
- Fixture: exact byte-pinned 3DMX / CCD BNZ, model 1, assembly 1 monomer A1, polymer entity 1, label/auth chain A, C54T/C97A/L99A, 164 positions.
- Runtime: CPython 3.13.16 x86-64 and RDKit 2026.03.6 in the already authorized Ubuntu 24.04.5 WSL2 environment.

The machine-readable profile is `PREPARATION_RUN_CONFIG.json`. This version supersedes v1.0 only for the single development fixture preparation authorized by AUTH04 and the bounded continuation authorization.

## Exact v1.0 → v1.1 delta

| Position | Residue | v1.0 | v1.1 | Source occupancy |
|---:|---|---|---|---:|
| 68 | ASN | Unlisted, fail-closed | Select coherent A plus common blank atoms | A 0.70 / B 0.30 |
| 72 | ASP | Unlisted, fail-closed | Select coherent A plus common blank atoms | A 0.80 / B 0.20 |
| 76 | ARG | Unlisted, fail-closed | Select coherent A plus common blank atoms | A 0.60 / B 0.40 |

MET106 A (0.70) and GLU108 A (0.70) remain as authorized. All unlisted altloc groups remain rejected. The selected polymer receptor contains 1,306 heavy atoms, with all 164 residues and every expected CCD heavy atom represented exactly once. Excluded B source rows remain in source evidence and the alternate-disposition manifest.

## Frozen science retained

- Source hashes: 3DMX `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef`; BNZ `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61`.
- pH 6.9 remains a crystal-growth-condition proxy only.
- Asp/Glu deprotonated; Arg/Lys protonated; Tyr neutral; HIS31 neutral HID; GLU128 remains −1; Met1 N-terminus +1; Leu164 C-terminus −1. The exact 51-side-chain list is unchanged.
- ASN68 remains neutral CCD amide: OD1 is acceptor and ND2 is donor. No OD1/ND2 atom-name swap or side-chain flip is performed.
- All listed state-sensitive positions are explicitly present in the profile table; remaining standard residues use the explicit neutral CCD component graph state. Exact per-residue charge and hydrogen-parent inventory appears in `SOURCE_PROFILE_COMPLETENESS_MATRIX.csv`.
- Existing CORE_DRY_V1 water, HED, PO4, CL and BNZ occurrence decisions are unchanged.
- Existing `Chem.AddHs(molecule, explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)` operation is unchanged. The same no-query, no-implicit-state-selection, no-optimization and zero heavy-coordinate-change constraints apply.

The full selected atoms, occupancy mapping, state category, hydrogen-parent rule, inclusion status, and provenance for each residue are in the 164-row matrix. `PROFILE_CORRECTION_AUTHORIZATION.md` records why each addition is inside the bounded owner authorization. `PROFILE_OMISSION_ROOT_CAUSE.md` records the separate reason each residue was absent from v1.0.
