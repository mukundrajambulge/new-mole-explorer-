# Smoke redock 2026-10-09

**SMOKE: implementation sanity, not validation.** Not a benchmark, not a qualification, not the D9 campaign (40 replicates, Wilson CI, paired bootstrap).
Nothing was tuned on these numbers. The cases are Astex-diverse-style; membership in the Astex Diverse Set (a D9 regression set) was not verified here, so treat all of them as holdout-adjacent and never tune any parameter on them.

## Caveats

- 3 replicates per case, 5 cases: no confidence interval is meaningful at this size. Replicates of one case share the receptor, box and start conformer, so they are not independent.
- Protonation is the CCD template state as submitted (EXPLICIT_SUBMITTED): biotin is a neutral acid and benzamidine a neutral amidine, so their O/O and N/N pairs are chemically distinct and do not count as symmetric.
- The box is derived from the crystal ligand (redocking), so the search region already encodes the answer's location; this checks the pipeline, not pocket finding.
- Direct RMSD uses one arbitrary canonical-order mapping; where it is far above the symmetric value (for example a C2-symmetric ligand) the pose is a symmetry image, not a failure.

## Protocol

- Tool: `node tools/mole-dock/redock.mjs --report` (git 7e895b9); RMSD helper workers/prep/mole_prep/redock_smoke.py.
- Engine: AutoDock Vina 1.2.7 (`AutoDock Vina v1.2.7`), binary sha256 f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644. Vina commit: not recorded by the release binary (official v1.2.7 Linux x86_64 release; the research comparator pin 8eb4040 is not verified for this binary).
- Preparation: prep worker ME_PREP_INTERIM_V0, RDKit 2026.3.6, Meeko 0.8.0 (the research comparator lane is Meeko 0.7.1; digest C12). Prep acks were all given automatically (listed per case in the JSON).
- Starting ligand: prepared from the CCD isomeric SMILES alone, RDKit ETKDGv3 conformer (seed below), Gasteiger charges, Meeko torsion tree. Never the crystal pose.
- Box: crystal-ligand heavy-atom envelope + 5.0 A on every face (axis-aligned, not a cube); Vina snaps the grid to 0.375 A.
- Search: exhaustiveness 8, 9 poses, cpu 4, 3 replicates per case; seed = 1 + (uint64(SHA-256("mole-explorer/R.1/smoke-redock/v1" NUL id NUL replicate)[0:8]) mod (2^31-1)).
- RMSD: heavy-atom RMSD in the receptor frame, no superposition; symmetric = min over exact graph isomorphisms (RDKit GetSubstructMatches uniquify=False useChirality=True, then element/charge/aromaticity/H-count/bond-order/CIP checks); budget 1048576 mappings; direct = canonical-order identity mapping; UNDEFINED when no valid mapping. Success is inclusive (<=). Top-1 = Vina rank 1; best-of-N = the lowest symmetric RMSD among the 9 poses of one replicate.
- Overall rates: the case is the unit, so overall = mean of the per-case rates over OK cases.

## Cases

| Case | Ligand | Status | Heavy atoms | Valid mappings | Conformer seed | Box center | Box size |
|---|---|---|---|---|---|---|---|
| 1STP | BTN A300 | OK | 16 | 1 | 61453 | 11.4195, 2.371, -11.3725 | 16.545 x 16.004 x 17.519 |
| 1IEP | STI A201 | OK | 37 | 4 | 61453 | 15.19, 53.9025, 16.917 | 18.664 x 26.739 x 23.526 |
| 3PTB | BEN A1 | OK | 9 | 2 | 61453 | -1.8555, 14.366, 16.748 | 11.883 x 13.95 x 14.514 |
| 1HVR | XK2 A263 | OK | 46 | 8 | 61453 | -8.715, 15.544, 27.9 | 19.97 x 17.46 x 27.102 |
| 4DJW | 0KP A501 | OK | 26 | 2 | 61453 | 24.067, 11.087, 21.6305 | 21.574 x 13.952 x 16.775 |

## Per case x seed

| Case | Rep | Vina seed | Seed uint64 | Top-1 Vina score | Top-1 sym RMSD | Top-1 direct RMSD | Best-of-N sym RMSD (rank) |
|---|---|---|---|---|---|---|---|
| 1STP | 0 | 1508494222 | 15226016028502684090 | -7.270 | 0.691 | 0.691 | 0.691 (1) |
| 1STP | 1 | 871615064 | 2648766464918498357 | -7.301 | 0.757 | 0.757 | 0.757 (1) |
| 1STP | 2 | 267094916 | 16020843928819374632 | -7.311 | 1.062 | 1.062 | 1.062 (1) |
| 1IEP | 0 | 1292648990 | 17221706623354711102 | -12.093 | 1.290 | 1.426 | 1.290 (1) |
| 1IEP | 1 | 1519564701 | 11113150576070690935 | -12.029 | 1.286 | 1.425 | 1.286 (1) |
| 1IEP | 2 | 880730001 | 12173998140463606256 | -12.062 | 1.275 | 1.416 | 1.275 (1) |
| 3PTB | 0 | 494458240 | 11112270830452303513 | -6.025 | 0.375 | 1.588 | 0.375 (1) |
| 3PTB | 1 | 59917128 | 10274356729246814528 | -6.033 | 0.386 | 1.583 | 0.386 (1) |
| 3PTB | 2 | 772069245 | 4354528174628409056 | -6.025 | 0.364 | 1.581 | 0.364 (1) |
| 1HVR | 0 | 1581014239 | 12853299494904409415 | -11.588 | 0.645 | 0.935 | 0.645 (1) |
| 1HVR | 1 | 621702079 | 4733934177796869026 | -11.593 | 0.689 | 0.689 | 0.639 (2) |
| 1HVR | 2 | 2106777565 | 236422380237553167 | -11.568 | 0.624 | 9.923 | 0.624 (1) |
| 4DJW | 0 | 1410922871 | 17728863686615224900 | -9.714 | 1.289 | 1.536 | 1.289 (1) |
| 4DJW | 1 | 934392077 | 1639334110192305580 | -9.731 | 1.307 | 1.547 | 1.307 (1) |
| 4DJW | 2 | 1421086453 | 9240254457344432641 | -9.708 | 1.296 | 1.543 | 1.296 (1) |

## Success rates (top-1 / best-of-N)

| Case | <= 1.0 A | <= 1.5 A | <= 2.0 A | <= 2.5 A | <= 3.0 A |
|---|---|---|---|---|---|
| 1STP | 67% / 67% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| 1IEP | 0% / 0% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| 3PTB | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| 1HVR | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| 4DJW | 0% / 0% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| Overall (5 cases, macro) | 53% / 53% | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |

Raw numbers (every pose, every seed, versions, box min/max): the JSON next to this file.
