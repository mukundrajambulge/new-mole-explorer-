# D3-TOR-01 — Vina v1.2.7 torsion profile

## Gate

**D3-TOR-01 PASS — READY FOR D3 FOLLOW-UP REVIEW**. The application, native scorer, and protected regressions pass. D3 as a whole remains on HOLD; D4 remains blocked; production docking and `DOCKING.RUN` remain unavailable.

## Scope and result

This change implements the bounded D3-TOR-01 representation and direct-scoring slice. It adds the separately versioned `ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1` profile, a fail-closed PDBQT importer that requires authoritative atom correspondence to a frozen D2 graph, and direct scorer input that carries an explicit Vina torsion assignment. It does not add a ligand preparer, docking search, receptor preparation, or production run path.

The profile pins AutoDock Vina 1.2.7 source commit [`8eb40404f4f45608acb3b01427587ac049f27c1`](https://github.com/ccsb-scripps/AutoDock-Vina/tree/8eb40404f4f45608acb3b01427587ac049f27c1) and semantic digest `sha256:0c042369f70f8a555930aa32cf2c0211abf93ef4bc837cdb389caff50e0edc6b`. Vina source references used to define branch retention and scorer flexibility are [`parse_pdbqt.cpp`](https://github.com/ccsb-scripps/AutoDock-Vina/blob/8eb40404f4f45608acb3b01427587ac049f27c1/src/lib/parse_pdbqt.cpp) and [`model.cpp`](https://github.com/ccsb-scripps/AutoDock-Vina/blob/8eb40404f4f45608acb3b01427587ac049f27c1/src/lib/model.cpp).

The importer preserves raw `TORSDOF` and BRANCH/ENDBRANCH topology as independent source evidence. It derives active search axes from the mapped branch subtree, and derives scorer `N_tors` from active mapped heavy-atom rotors and heavy-atom graph degree. Each eligible rotor endpoint contributes exactly 0.5; the pinned contribution set is 0, 0.5, or 1.0 per bond. A `TORSDOF`/raw-branch count mismatch is retained as a diagnostic and does not overwrite any derived value. The direct scorer consumes the profile-bound assignment and applies `E = E_inter / (1 + 0.05846 * N_tors)`; search-axis count is separate metadata.

The existing D2 contract and adapter files are unchanged. PyMOL sources and application behavior are unchanged; the final PyMOL acceptance regression remains green.

## D3-IR-02 expected versus actual

The retained reference matrix has 23 cases: 22 accepted by the unmodified Vina 1.2.7 reference and one malformed unclosed-branch rejection. Tuples below use `(raw branch count, raw TORSDOF, active search axes, N_tors)`. Expected values come from `reference_execution_details.json`; actual values are the importer output asserted by the D3 test. `—` means the reference rejects before those values can be assigned.

| Case | Expected | Actual | Result |
|---|---:|---:|---|
| `acetamide` | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | PASS |
| `benzene` | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | PASS |
| `butane` | `(1, 1, 1, 1)` | `(1, 1, 1, 1)` | PASS |
| `ethylbenzene` | `(1, 1, 1, 1)` | `(1, 1, 1, 1)` | PASS |
| `methyl_acetate` | `(1, 1, 1, 1)` | `(1, 1, 1, 1)` | PASS |
| `n_methylacetamide` | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | PASS |
| `toluene` | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | PASS |
| `keepH_acetamide` | `(1, 1, 1, 0.5)` | `(1, 1, 1, 0.5)` | PASS |
| `keepH_benzene` | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | PASS |
| `keepH_butane` | `(3, 3, 3, 2)` | `(3, 3, 3, 2)` | PASS |
| `keepH_ethylbenzene` | `(2, 2, 2, 1.5)` | `(2, 2, 2, 1.5)` | PASS |
| `keepH_methyl_acetate` | `(3, 3, 3, 2)` | `(3, 3, 3, 2)` | PASS |
| `keepH_n_methylacetamide` | `(2, 2, 2, 1)` | `(2, 2, 2, 1)` | PASS |
| `keepH_toluene` | `(1, 1, 1, 0.5)` | `(1, 1, 1, 0.5)` | PASS |
| `acetamide_resonance_cn_torsdof_0` | `(1, 0, 1, 0.5)` | `(1, 0, 1, 0.5)` | PASS |
| `acetamide_resonance_cn_torsdof_1` | `(1, 1, 1, 0.5)` | `(1, 1, 1, 0.5)` | PASS |
| `acetamide_resonance_cn_torsdof_2` | `(1, 2, 1, 0.5)` | `(1, 2, 1, 0.5)` | PASS |
| `acetamide_terminal_nh_torsdof_1` | `(1, 1, 0, 0)` | `(1, 1, 0, 0)` | PASS |
| `benzene_no_branch_torsdof_1` | `(0, 1, 0, 0)` | `(0, 1, 0, 0)` | PASS |
| `malformed_unclosed_branch` | `REJECT` | `REJECT` | PASS |
| `toluene_terminal_cc_torsdof_0` | `(1, 0, 0, 0)` | `(1, 0, 0, 0)` | PASS |
| `toluene_terminal_cc_torsdof_1` | `(1, 1, 0, 0)` | `(1, 1, 0, 0)` | PASS |
| `toluene_terminal_cc_torsdof_2` | `(1, 2, 0, 0)` | `(1, 2, 0, 0)` | PASS |

The fixture set contains 32 files copied byte-for-byte from the registered D3-IR-02 archive, with zero SHA-256 mismatches. For the existing bounded SDF ingestion fixture only, the test replaces an initial empty title line so the reader retains the V2000 counts line at its expected position; atom, bond, coordinate, and property records remain unchanged. The checked-in source SDF and its archive hash remain exact.

## Changed surface

- `packages/contracts/src/docking/d3VinaTorsion.ts` and its barrel export define the separately versioned profile and D3 evidence, topology, atom mapping, and scorer-assignment contracts.
- `apps/api/src/docking/d3VinaTorsion.ts` seals authoritative mapping evidence and imports the exact PDBQT bytes against the D2 graph, retaining raw topology and producing separate search and scorer assignments.
- `native/docking-reference/scoring/` accepts the profile-bound assignment, validates a finite nonnegative half-unit `N_tors`, reports its provenance, and uses it in the Vina divisor.
- `apps/api/src/docking/fixtures/d3-ir-02/` retains the reference matrix, source metadata, seven SDFs, seven default PDBQTs, seven explicit-hydrogen PDBQTs, and nine adversarial PDBQTs.
- `apps/api/src/docking/d3VinaTorsion.test.ts` covers the full 23-case matrix, mismatch controls, exact half-unit values, provenance failures, unsupported atom typing, byte-digest mismatch, and stable scoring assignment under root atom record reordering.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck --workspaces` | PASS |
| `npm run lint --workspaces` | PASS |
| `npm exec --workspace @molecular/api -- vitest run src/docking/d3VinaTorsion.test.ts` | PASS — 7 tests |
| `npm test` | PASS — web 156 tests / 34 files; API 97 tests / 13 files, including the D1/D2 regressions |
| `npm run build --workspaces` | PASS — existing 3dmol `eval` and large-chunk warnings remain |
| `npx playwright test tests/e2e/final-pymol-acceptance.spec.ts` | PASS — 3/3 |
| Native CMake/Ninja build (Zig 0.16.0, Windows GNU target) | PASS — strict warning and floating-point flags enabled |
| Bundled CTest 4.4.3 `--test-dir <temp build> --output-on-failure` | PASS — 1/1 native test |
| Fixture SHA-256 verification | PASS — 32 files, 0 mismatches |
| Protected D2 diff check (`d2.ts`, `d2Adapters.ts`) | PASS — unchanged |

## Limits and next gate

This is an importer and scorer-reference slice, not a production preparation or docking workflow. Meeko v0.8 appears only as recorded fixture provenance. Synthetic adversarial fixtures keep producer provenance unknown. The importer requires externally supplied authoritative serial-to-AtomUID mapping and a matching source artifact digest; it does not infer atom identity from coordinates.

This bounded slice is ready for D3 follow-up review. Full D3 acceptance is still HOLD; D4 and production `DOCKING.RUN` remain blocked.
