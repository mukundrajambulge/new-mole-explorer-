# D3-CLOSURE-EXEC-01 report

**Disposition:** D3-CLOSURE-EXEC-01 PASS — PREPARED FIXTURE SEALED AND FULL-POSE D3 EVIDENCE COMPLETE; READY FOR FINAL D3 ACCEPTANCE

## Closure result

The earlier source/profile HOLD was resolved inside this same D3-CLOSURE-EXEC-01 package under the owner’s bounded continuation authorization. No new D3 gate was created. The original v1.0 stop record remains preserved in SOURCE_PROFILE_MISMATCH.md and the predecessor logs.

The corrected profile adds only the coherent maximum-occupancy A conformer plus common blank-altloc atoms for ASN68, ASP72, and ARG76. Their already approved chemical states were retained: ASN68 is neutral CCD Asn with OD1 acceptor / ND2 donor; ASP72 is deprotonated; ARG76 is protonated. No heavy atom was flipped, moved, repaired, optimized, or renamed.

## Profile reconciliation

- Predecessor: ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0 (1.0.0).
- Corrected: ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1 (1.1.0).
- Source-selected and profile-dispositioned polymer residues: 164 / 164.
- Explicit state-sensitive side chains: 51 / 51; both termini explicit.
- Altloc groups: exactly five, all listed and complete: ASN68, ASP72, ARG76, MET106, GLU108.
- Components: all 418 occurrences dispositioned; selected receptor heavy atoms: 1,306.
- Additional omissions: none. No unlisted state/default or extra selected source atom remains.
- Source-only completeness validator: PASS before chemistry import/construction.

See PROFILE_OMISSION_ROOT_CAUSE.md, PROFILE_CORRECTION_AUTHORIZATION.md, PROFILE_COMPLETENESS_VALIDATION.md, and SOURCE_PROFILE_COMPLETENESS_MATRIX.csv.

## Preparation and state seals

Exact 3DMX and BNZ input hashes were verified before parsing and recorded in both replay runs:
- 3DMX: e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef
- BNZ: 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61

The authorized Linux runtime imported CPython 3.13.16 and RDKit 2026.03.6. Hydrogen-only preparation generated 1,330 receptor and 6 ligand hydrogens. Both runs produced the same canonical scientific payload digest: 212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f. Heavy-atom additions, deletions, remappings, and in-memory coordinate-bit changes were all zero; serialization round-trip displacement was 0.0 Å.

PreparedReceptorState digest: sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06
PreparedLigandState digest: sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1
Receptor coordinate-state digest: sha256:7326d80384638649b8ba28664988b9332c276ca859d7e85d936cb0620b9e1f94
Ligand coordinate-state digest: sha256:6867f7bdf67192bcf16ccd11e730a61a7deb2d1e83eae5f13fd16249a8dcac95
SearchRegion digest: sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d

Independent canonical-CBOR digest replay validation passed every D2 graph, identity, chemistry, coordinate, prepared-state, ligand-kinematic, and SearchRegion check. Profile-aware D3 envelopes remain separate objects over the D2 state digests.

## SearchRegion and direct/grid evidence

The canonical closed validation region contains the deterministic six-pose fixture cohort. Grid spacing and interpolation halo are each 0.375 Å. Native geometry is 11 × 22 × 10 points (2,420 total), below the 110-point axis cap; 1,306 receptor scoring centers are below the 250,000 limit. All six poses, including the deposited crystal pose and the cutoff stress pose, were IN_DOMAIN. The field was built and no out-of-domain, extrapolation, or clamping result occurred.

The sealed-state comparison used the same receptor, ligand, profile, typing, torsion, and SearchRegion inputs for direct and interpolated scoring. The cohort contains crystal, translation, rotation, combined, half-cell grid-phase, and cutoff-stress cases. Full per-pose five-term values and weighted values are in FULLPOSE_TERM_DECOMPOSITION.csv and fullpose/results/.

For E_inter (grid minus direct), n=6:
- signed bias: 0.1753649452 kcal/mol
- MAE: 0.1837806169 kcal/mol
- RMSE: 0.2009211939 kcal/mol
- p50 / p95 / p99: 0.2004688330 / 0.2738164993 / 0.2868527181 kcal/mol
- maximum absolute error: 0.2901117728 kcal/mol

The tagged cutoff-stress subset has n=1 and absolute E_inter error 0.0252470152 kcal/mol. Its nominated source-backed atom pair is 7.999999999999998 Å in binary64, immediately below the 8.0 Å cutoff. That pose has large total overlap energy and is an algorithm stress case, not a plausible docking pose. Direct/grid orders were identical, with no pairwise reversals, no ties, and zero rank displacement.

No approved D3 direct-versus-grid approximation or ranking threshold was found. This package does not derive a new threshold from backend-equivalence tolerances. The measured cohort is evidence for D3-FINAL-01 to assess; it is not a broad error-bound claim.

## Regression

The current continuation passed:
- npm test: 47 files, 254 tests (web 34/156; API 13/98).
- D1 contracts 14, D2 preparation 11, D3-TOR 8, all within the workspace tests.
- D3-GRID scoring-field contract: 1 file, 5 tests.
- Native CMake/CTest: direct scorer and scoring field, 2/2 targets.
- Full-pose synthetic orchestration smoke: five marked control poses; fixture run: six sealed poses.
- Protected PyMOL browser suite: 3/3; all 40 screenshot fixture SHA-256 values restored to and verified against pretest bytes.
- Workspace typecheck, lint, and production build: PASS.

No D1/D2/D3-TOR, direct scorer, grid/channel-mapping/serialization, preparation, full-pose, or protected browser regression failed.

## Handoff

The only remaining D3 prompt is D3-FINAL-01. Review the measured per-term and total-error distribution, the no-reversal result, and the single cutoff-stress observation under the final acceptance process. Do not treat the six-pose cohort as a universal interpolation bound or invent a numerical threshold. D4 remains blocked and DOCKING.RUN remains unavailable until separately authorized.
