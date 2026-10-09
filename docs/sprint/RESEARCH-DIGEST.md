# Research digest: what the owner's docking research requires (W11)

Source: the owner's Google Drive research, read 2026-10-09. These are research facts, not new tasks. Any change to a profile, constant
or label that this digest suggests still needs owner approval (CLAUDE.md engineering rules).

Short names used in citations:
- **AccSpec**: PHD-V2 Final Docking Acceptance Specification v1.0 (2026-09-18). Cited by acceptance-test id, e.g. AT-0142. It is the authoritative catalogue: 290 tests at levels L1-L9, gates D0-D10.
- **V2-01**: PHD-V2-01 Scientific Foundations, Task Ontology, Capability Boundary & Claim Semantics.
- **V2-00**: PHD-V2-00 Existing Docking Research Audit & Gap Map.
- **R15**: P1-R15 Docking Validation, Benchmarking & HTS.
- **R02**: Research 02 v2.0 DEEP, Molecular Representation & Preparation.
- **R03-03 / R03-14**: Research 03 v2 (mmCIF identity/altlocs; implementation spec/handoff).
- **R01**: Research 01 v2.0 DEEP, Mathematics/Physics/Docking Theory.

- **V2-xx** (section 8 only): PHD-V2-03..14 v1.0, cited [PHD-V2-xx §n]. Read 2026-10-09 (part 2, task R.8).

Sections 1-7 were written before PHD-V2-03..14 were read. Section 8 adds them and supersedes earlier text where it says so.

## 1. Claim semantics

**What a score is.** A DockingScore is "an empirical docking/search ranking score under the named profile" [AccSpec AT-0107]. It must
never be labelled experimental affinity, binding free energy, binding probability, confidence or "best binder" evidence
[AccSpec AT-0108; V2-01 App.C]. A kcal/mol-like scale does not make a value a free energy [V2-01 §8; R01 §16].

Every score carries: name, value, direction, scale or unit semantics, model/profile/version and provenance [V2-01 App.C; R01 §16; R15 §3.5].
Raw scores from different engines are never averaged or treated as interchangeable [R15 §10 St.9, §13].

**Claim register** [V2-01 App.C]:
- Allowed: "Docking completed" (it says nothing about validity), "Pose generated", "Pose ranked" / "Top-ranked pose" (name the profile), "Docking score" (with full semantics).
- Retrospective only: "Native-like pose", against a declared reference, mapping, symmetry policy and threshold [V2-01 PHDV2-CAP-AT-025].
- Conditional: "Binding mode predicted" needs a validated capability; otherwise say "model pose generated".
- Forbidden: "Binding affinity predicted", unqualified "Energy", "Free energy", "Confidence", "Probability" and "Best binder" for raw scores.
- Discouraged: "Affinity score".
- Completion is not validation. Rank 1 is not "best binder" [V2-01 Exec, D10].

**Label vocabulary.** The research keeps several separate axes, which must never be collapsed into one field [V2-01 §15.9-15.10; AccSpec AT-0229]:

| Axis | Research values |
|---|---|
| Capability negotiation | SUPPORTED, EXPERIMENTAL, UNVALIDATED, AMBIGUOUS, UNSUPPORTED, INVALID. No SUPPORTED_WITH_WARNING [V2-01 Exec, App.B#3] |
| Implementation evidence | DESIGN_ONLY, IMPLEMENTED_UNVERIFIED, UNIT_VERIFIED, REFERENCE_DIFFERENTIAL_VERIFIED, REGRESSION_VERIFIED |
| Scientific validation | NOT_EVALUATED, STRUCTURAL_BENCHMARKED, TASK_BENCHMARKED, DOMAIN_VALIDATED, SUPPORTED_PRODUCTION |
| Release state | IMPLEMENTED / UNQUALIFIED before D9. After D9: "SUPPORTED — ORDINARY-V1 SITE-DIRECTED POSE PREDICTION WITHIN VALIDATED DOMAIN" [AccSpec AT-0183, 0275, 0276] |
| Durable JobStatus | exactly Created, Queued, Running, Completed, Failed, Cancelled [AccSpec AT-0227] |
| Not job states | READY, BLOCKED, INVALID, AMBIGUOUS, UNSUPPORTED, COMPLETED_NO_ELIGIBLE_POSE belong on other axes [AccSpec AT-0228] |
| Failure codes | INVALID_JOB_DEFINITION, AMBIGUOUS_SCIENTIFIC_STATE, CAPABILITY_UNSUPPORTED, CHEMISTRY_UNSUPPORTED, CAPABILITY_PROFILE_MISMATCH, VALIDATION_LEVEL_INSUFFICIENT, EXPERIMENTAL_CAPABILITY_NOT_AUTHORIZED, CLAIM_NOT_SUPPORTED [V2-01 §14]. Campaign classes: INPUT_INVALID … NONDETERMINISM_DETECTED [R15 §9] |
| Command availability | DOCKING.RUN stays runtime UNAVAILABLE until D8 [AccSpec AT-0240, 0262] |

**How the research labels map to ours.**

| Ours | Closest research meaning |
|---|---|
| UNAVAILABLE | Matches "runtime UNAVAILABLE / fail-closed" [AT-0240] |
| BLOCKED | A preflight/result axis value, never a JobStatus [AT-0228]. Its underlying reasons should become AMBIGUOUS, UNSUPPORTED or INVALID |
| PREVIEW_UNQUALIFIED | No exact equivalent. Closest: capability EXPERIMENTAL (opt-in, status persisted in UI/API/export/provenance [V2-01 App.C]), plus implementation IMPLEMENTED_UNVERIFIED and validation NOT_EVALUATED. For the Mole engine before D9, the research term is IMPLEMENTED / UNQUALIFIED [AT-0275] |

Warnings may accompany SUPPORTED only when informational. Anything that changes scientific definedness must resolve to
AMBIGUOUS, UNSUPPORTED, UNVALIDATED or INVALID [V2-01 §14]. INVALID, AMBIGUOUS, UNSUPPORTED and hard resource rejection have no
override and no `--force` [AccSpec AT-0137, 0231].

## 2. Docking acceptance criteria

**Benchmark sets** [AccSpec AT-0165..0169; R15 §4-5]:
- Primary redocking holdout: PoseBusters Benchmark, Zenodo 8278563 v1. All 428 source cases must be dispositioned; the 308-case paper subset is identified separately.
- Astex Diverse (85 cases): historical regression and comparator-sanity evidence only, not the sole holdout.
- Astex Non-native: a separate cross-docking campaign, never merged into redocking claims.
- CASF-2016: a secondary diagnostic that does not make the score an affinity.
- DockGen: optional generalization stress test.
- Screening (post-V1): DUD-E / DEKOIS plus LIT-PCBA, reported per target and macro-averaged [R15 §5, Gate E]. Production HTS is NOT AUTHORIZED [AT-0199].

**RMSD method** [AccSpec AT-0142..0150; R15 §3.1-3.2]:
- Computed in the receptor frame, over ligand heavy atoms, with no ligand superposition (no post-mapping fit).
- Symmetry-aware, using exact graph automorphisms that preserve the ChemicalState, stereochemistry and chemical labels.
- If no exact mapping exists or the budget is exceeded, the RMSD is undefined with a typed status. Nearest-element, Hungarian or index fallbacks are forbidden.
- Budget: at most 1,048,576 automorphisms or 1e7 search nodes per comparison, and at most 2.5e8 mapping evaluations per attempt.
- R15 also asks to store the direct-mapping RMSD next to the symmetric one, and to use the symmetric value for classification.
- Cross-docking: superpose receptors with a declared atom set, then compute the ligand RMSD in that frame and record the receptor RMSD.
- Docking RMSD must be its own typed API, never the viewer/PyMOL `rms`/`fit` [AT-0148, 0267].

**Success thresholds** [AccSpec AT-0170, 0171, 0147, 0145]:
- Primary: Top-1 RMSD ≤ 2.0 Å (inclusive).
- Also report 1.0, 1.5, 2.5 and 3.0 Å, and keep the continuous distribution [R15 §3.1].
- The 2.0 Å clustering radius is a separate semantic from the 2.0 Å validation threshold.

**Validation protocol** [AccSpec AT-0172..0176]:
- Search box: the crystal-ligand heavy-atom envelope plus exactly 5.0 Å padding on every face.
- The starting ligand is prepared independently and must not start from the crystal pose.
- 40 predeclared replicates per case, with seeds derived by domain-separated SHA-256 into uint64.
- The case, not the seed, is the statistical unit.
- Statistics: Wilson 95% CI for binary success; 10,000-resample case bootstrap for continuous summaries; paired case bootstrap for comparator differences.

**Qualification gates** [AccSpec AT-0177..0183]:
- Comparator: AutoDock Vina v1.2.7, commit 8eb4040, prepared with Meeko v0.7.1 (commit f4a8c1e) as the package-native lane.
- Sanity check: Vina's Astex Top-1 ≤ 2 Å rate must fall in 45-70%; otherwise the comparator configuration is invalid.
- Pass: the lower 95% CI of (Mole − Vina) must be > −0.05 for both macro Top-1 and sampling success, and gates Q3-Q7 must pass.
- Any tuning after viewing holdout results burns that campaign version.

**Reproducibility** [AccSpec AT-0156, 0157; R15 §8, Gate F]:
- Classes: EXACT_EXECUTION_REPLAY, BYTE_IDENTICAL_SCIENTIFIC_OUTPUT, NUMERICALLY_EQUIVALENT_REPLAY, SCIENTIFIC_RESULT_EQUIVALENT, STATISTICALLY_REPRODUCIBLE, INSUFFICIENTLY_SPECIFIED_NONREPRODUCIBLE.
- A failed stronger class must never be silently downgraded to a weaker one.

**Reference numerics** [AccSpec AT-0200..0209, 0257, 0258]:
- Scalar CPU binary64, round-to-nearest-even, signed zeros and subnormals preserved, FTZ/DAZ off.
- No FMA contraction, fast-math or reassociation. Fixed reduction order.
- Pinned toolchain: Ubuntu 24.04, GCC 13.3.0, C++20.
- Backend-versus-reference tolerances:

| Quantity | Tolerance |
|---|---|
| Raw score | abs ≤ 1e-10 or rel ≤ 1e-12 |
| Grid term | abs ≤ 1e-10 |
| Gradient | abs ≤ 1e-8 or rel ≤ 1e-7 |
| Pose | heavy-atom RMSD ≤ 1e-6 Å, max component error ≤ 5e-6 Å |
| Same-mapping RMSD | abs ≤ 1e-10 Å |

Any change in Q_score, cluster or threshold class fails, even when inside these tolerances [AccSpec §8].

**Comparison with real Vina (scores).** AccSpec sets no numeric tolerance for Mole-versus-Vina per-pose scores. Vina is a
benchmark comparator judged by the paired-bootstrap gates above. The 1e-10 tolerances apply only between our own backends and
the scalar reference. The D3 direct-versus-grid approximation threshold is explicitly still an owner decision [AccSpec AT-0103 v1.2].

## 3. Preparation science: research requirement versus task 5.2

**Core profile.** The core profile ME_DOCKING_V1_CORE_EXPLICIT_STATE_1_0 performs no automatic protonation/pKa, tautomer or stereo
enumeration, no 2D→3D embedding, no minimization and no automatic rotor or torsion-tree construction. Every input state must be explicit
[AccSpec AT-0054, 0066-0068, 0072, 0075; V2-01 §13]. Anything generated is therefore outside the core profile.

| Topic | Research | 5.2 today | Verdict |
|---|---|---|---|
| Receptor protonation | Needs explicit target_pH and a named validated profile; no auto-pKa in core [AT-0053, 0054] | Default keeps submitted H; PROPKA is opt-in and marked PREVIEW | Consistent |
| Receptor hydrogens | Downstream of the explicit state; heavy-atom coordinates preserved [AT-0055] | Meeko residue templates add H. This is generated state, labelled PREVIEW | Consistent |
| Histidine | Every His microstate explicit; unresolved site-critical His blocks [AT-0052; R02 §12, §43] | Implicit, from Meeko templates; not reported per residue | Gap |
| Ligand protomers/tautomers | Distinct ChemicalStates; no silent collapse; no auto-enumeration in core [AT-0064..0066; R02 §9-11] | Dimorphite/RDKit can generate them (PREVIEW) | Preview only |
| Stereo | Undefined material stereo is AMBIGUOUS [AT-0063] | Assigned from 3D; templates such as biotin's carry no stereo | Gap (C7) |
| Bond orders | PDB ligand coordinates alone cannot establish identity [AT-0038] | Blocks without SDF/MOL2/SMILES template | Consistent |
| Charges | Formal charge lives in ChemicalState; partial charges never enter the score [AT-0032, 0099; R02 §17] | Meeko Gasteiger charges; Vina ignores them | Consistent; keep it so in mole-score |
| Waters | CORE_DRY_V1 excludes waters but keeps evidence and exclusion provenance; mobile water UNSUPPORTED [AT-0056, 0132; R02 §15, §49] | All removed and listed; keepWaters → BLOCKED | Consistent |
| Metals/cofactors | UNSUPPORTED when they control binding; no silent deletion [AT-0057, 0130, 0131; R02 §16, §50; R15 §10 St.1] | All hetero groups removed after one acknowledgement | Gap (C8) |
| Altlocs | COHERENT_MAX_OCCUPANCY_V1 only when one coherent conformer is uniquely admissible; per-atom hybrids forbidden [AT-0048; R03-03 §3, §7] | Per-residue max occupancy; ties go to the first label | Gap (C9) |
| Models/assembly | Multiple models without explicit selection are AMBIGUOUS; never assume assembly 1 [AT-0045..0047] | model 1 fixed | Gap (C9) |
| Missing atoms/loops | No silent repair of site heavy atoms; site-affecting loops block [AT-0049, 0050] | Opt-in PDBFixer atoms; loops never built | Consistent if the opt-in is labelled PREVIEW |
| PDBQT | Never canonical identity; derived, with a loss manifest [AT-0039..0041; R02 §21, §52] | Output only | Consistent |
| Identity | mmCIF label_* and auth_* both kept; stable AtomUID that is not a serial number [AT-0031, 0033; R03-03 ID-001..005] | Prep renumbers serials | Check that the mapping is kept |

**Limits.**
- Ligand: ≤ 256 atoms, ≤ 128 heavy atoms, ≤ 384 bonds, ≤ 32 torsions [AT-0214].
- Receptor: ≤ 250k atoms, ≤ 50k residues [AT-0215].
- Box: side ≤ 40 Å and volume ≤ 64,000 Å³ [AT-0092]. Our 40 Å edge cap matches.

## 4. Requirements per open task

**5.4 / 5.5 job runner and endpoints**
- Workflow is Configure → Preflight → Freeze → Run [AT-0223..0226]. Freeze persists the concrete seed, states, profiles and resources. After freeze, no worker reads UI state.
- JobStatus uses exactly six values [AT-0227]. Preflight, capability and result statuses are separate fields [AT-0229].
- Idempotency binds caller scope, operation, target and payload digest. A conflicting reuse of a key fails [AT-0232, 0233].
- Cancel is cooperative and recorded durably. A partial run is never a result [AT-0128, 0234].
- Retry creates a new ExecutionAttempt with the same seed and RNG. A new seed or budget is a rerun with new lineage [AT-0129, 0235, 0236]. At most 2 retries [AT-0218].
- The store is SQLite WAL with migrations, plus content-addressed artifacts [AT-0251, 0252].
- One native child process per attempt; the watchdog defaults to 30 min (24 h at most); RSS 2 GiB by default, 4 GiB hard [AT-0217, 0220, 0253].
- Log caps: diagnostics 64 MiB, logs 16 MiB, provenance 4 MiB [AT-0221].
- Paths are artifact references only; no shell or eval [AT-0242..0247].

**5.6 capability labels**
- Fail closed until a gate promotes the capability [AT-0240].
- The user must see why a capability is unavailable and what would resolve it [V2-01 §19].
- Experimental status must persist into the API, exports and provenance, not only a UI banner [V2-01 App.C].

**5.3 part 2: C++ re-scoring (mole-score)**
- Profile: ME_DOCKING_V1_VINA_CLASSIC_1_0, with ME_XS_TYPING_V1_1_0 typing and ME_SUPPORTED_CHEMISTRY_V1_1_0 chemistry [AT-0094].
- Terms: gauss1, gauss2, repulsion, hydrophobic, H-bond, with weights [-0.035579, -0.005156, +0.840245, -0.035069, -0.587439] [AT-0095, 0096]. This matches `scoring.hpp`.
- Cutoff 8.0 Å on surface distance; field support horizon 8.649519052838329 Å [AT-0097, 0105].
- Reported score = inter/(1 + 0.05846·N_tors_vina). N_tors can be fractional (0.5, 1.5 cases) and is never coerced to an integer. It is separate from search_torsion_count [AT-0076, 0098; amendment D3-DEC-02].
- No electrostatics or partial charges. Per-term decomposition preserved. No "Vina-like" substitutes [AT-0099, 0101, 0106].
- Unknown types fail closed, with no carbon fallback [AT-0071].
- Grid: 0.375 Å, 80 logical channels in a 59-array map (the old "70 channels" text is superseded), trilinear interpolation [AT-0103 v1.1/v1.2, AT-0104].
- Ties: Q_score quantum 1e-6. Final modes: at most 9, within best + 3.0 [AT-0141, 0146].

**4.7 compare with Vina**
- Complexes come from Astex Diverse or another non-holdout set. PoseBusters v1 is the holdout and must stay untouched [AT-0165, 0166, 0182].
- Pin Vina by commit 8eb4040, not only by version [AT-0177].
- R15 asks for a quality-matched comparison and a resource-matched comparison, with end-to-end timing [R15 §7.4].

**4.8, 8.1, 5.8**: superseded by sections 8.2-8.4. AccSpec points kept there: gradients in 6+N coordinates [AT-0111]; out-of-box inadmissible, never clipped or penalized [AT-0083..0085]; the field covers admissible coordinates plus the halo [AT-0091]; search family, BFGS and RNG [AT-0112..0126]; provenance binding [V2-01 §20; AT-0154..0161].

**2.8 (-0 versus 0 in the digest)**
- Scientific hashes use ME_CANONICAL_CBOR_V1_1_0 with SHA-256 framed envelopes, not the viewer's canonical-JSON profile [AT-0151, 0153].
- Binary64 values use exact F64Bits, *including signed zero* [AT-0152]. CBOR golden vectors include signed-zero cases [INT-FX-017], and weighted −0.0 is preserved bit-exactly [AT-0103 v1.1].
- So the research does not allow −0 ≡ 0 at the encoding layer.
- Box bounds are canonical min/max, and center/size are derived full extents, never half-extents [AT-0081].

## 5. Conflicts

1. **[RESOLVED by PHD-V2-07] 4.8 out-of-box rule.** The backlog's "pushed back, slope penalty" design is rejected. E_search has no box term, and out-of-box poses are rejected unscored [PHD-V2-07 §8, §13]. See the replacement spec in 8.2.
2. **[major] 2.8 normalizes −0 to 0 before hashing**, which conflicts with F64Bits signed-zero semantics [AT-0152, INT-FX-017]. Recommendation:
   - Keep the hash encoder bit-exact.
   - If −0 and 0 boxes should be equal, do it as an explicit, documented input-canonicalization step in the SearchRegion constructor before sealing. Apply it to geometry only, never to scores or weights.
   - Owner decision (Q5).
3. **[major] DOCKING.RUN is switched to PREVIEW_UNQUALIFIED (5.6)**, but the research keeps DOCKING.RUN UNAVAILABLE until D8 [AT-0262]. Our preview runs external Vina, not the Mole engine. Recommendation:
   - Expose the Vina preview as a separate capability id (for example VINA_COMPARATOR_PREVIEW) with the status EXPERIMENTAL, IMPLEMENTED_UNVERIFIED and NOT_EVALUATED.
   - Leave the Mole-engine DOCKING.RUN at UNAVAILABLE.
   - Store all three axes in result.json and in exports.
4. **[major] Redocking check (redock.mjs) versus the qualification protocol.**

   | Aspect | redock.mjs | Research |
   |---|---|---|
   | RMSD | symmetry-naive | automorphism-exact [AT-0143] |
   | Starting ligand | the crystal ligand file | independent preparation [AT-0173] |
   | Box | cube of max(22, extent+10) | envelope + 5 Å per face [AT-0172] |
   | Seeds | 1 | 40 replicates [AT-0174] |
   | Bar | "≥4 of 5 ≤ 2 Å" | Wilson CI and paired bootstrap versus Vina [AT-0176, 0179] |

   Recommendation:
   - Rename our bar to "smoke redock (implementation sanity)", never "validated".
   - Add symmetry RMSD (keep the direct RMSD as well) and the 5 Å-padding box.
   - Start from an RDKit-embedded conformer.
   - Report 1/1.5/2/2.5/3 Å and use at least 3 seeds now.
   - The 0.386 Å and 0.923 Å results are smoke evidence only.
5. **[major] Job states (5.4).** Ours are QUEUED/PREPARING/RUNNING/SUCCEEDED/FAILED/CANCELLED, plus BLOCKED used as a status. The research requires exactly Created/Queued/Running/Completed/Failed/Cancelled [AT-0227, 0228]. Recommendation: rename SUCCEEDED→Completed, add Created, and move PREPARING into an ExecutionAttempt stage or event field.
6. **[major] Store.** 5.4 uses a file store; the research requires SQLite WAL with migrations [AT-0252]. Recommendation: record an ADR in TOOLS.md/STATE that this is an interim deviation, and keep the store interface swappable. The dedupe-to-SUCCEEDED rule is also only partly right: idempotency must bind caller scope and operation [AT-0232].
7. **[major] Ligand stereochemistry.** Templates without stereo (the 1STP biotin SMILES), with stereo taken from 3D, conflict with AT-0063. Recommendation: use isomeric SMILES from the CCD and block when a stereocentre is undefined and not resolved explicitly.
8. **[major] Metals and cofactors** are removed with one acknowledgement, which conflicts with AT-0057/0131. Recommendation: classify hetero groups within 8 Å of the site; if a metal or cofactor is in the site, the task becomes UNSUPPORTED (CHEMISTRY_UNSUPPORTED), not removed.
9. **[minor] Altlocs and models.** Per-residue max occupancy with ties going to the first label, and model 1 fixed, conflict with AT-0047/0048. Recommendation: require one globally coherent altloc label (or an explicit user choice); ties → AMBIGUOUS; multiple models → AMBIGUOUS unless chosen.
10. **[minor] Histidine states** are implicit (Meeko templates), which conflicts with AT-0052. Recommendation: list the HID/HIE/HIP choice per His in plan.json, and flag site His as needing acknowledgement.
11. **[minor] Score unit label.** `run.mjs` writes `vinaScoreUnits: "kcal/mol (Vina estimate)"`, which the claim register forbids as an energy reading [V2-01 App.C]. Recommendation: use "Vina score (empirical, kcal/mol-scaled; not a binding free energy)", with scoreName/direction/profile fields.
12. **[minor] Comparator pins.** We use Meeko 0.8.0 and pin Vina by version only; the comparator is Vina commit 8eb4040 with Meeko 0.7.1 [AT-0177]. Recommendation: record the Vina commit, and add a Meeko 0.7.1 lane for D9 comparisons (0.8.0 may stay for preview).
13. **[minor] Seeds.** 5.4 requires seed ≥ 1; the research says uint64 with 0 valid, and an omitted seed is drawn from the OS CSPRNG and persisted before the run [AT-0117, 0118]. Recommendation: keep the Vina adapter cap as an adapter limit. The canonical request seed is uint64; map it to Vina's range deterministically and record both values.
14. **[minor] 4.7 tolerance** "|Δ| ≤ 0.01 kcal/mol" is not a research number.
    - Against real Vina it is fine as an adapter-agreement check, provided it is labelled as such.
    - Between our own backends the research needs abs ≤ 1e-10 [AT-0204].
    - Draw the complexes from Astex, not PoseBusters [AT-0165].
15. **[minor] 4.8 gradient test.** The test uses relative error < 1e-6 against finite differences, while backend-equivalence tolerances are abs ≤ 1e-8 / rel ≤ 1e-7 [AT-0208]. Recommendation: keep the finite-difference check as a sanity test, add an analytic-versus-reference test at the AccSpec tolerance, and pick the finite-difference step deliberately [R01 §26].
16. **[minor] Box encoding.** The D2 SearchRegion already stores min/max, but the job contract (`jobs.ts`) and the 5.4 inputDigest use center + size, while the research wants min/max canonical with full extents derived [AT-0081]. Recommendation: compute the job digest from the sealed min/max SearchRegion.

## 6. Open questions for the owner

1. **Preview capability.** Is the Vina-backed preview a separate EXPERIMENTAL capability (as in C3), or should it be dropped until D8?
2. **Store.** Should SQLite WAL be required now (node:sqlite is still experimental), or is a recorded deviation acceptable for this sprint (C6)?
3. **Redock bar.** For the presentation, what does "real docking run" claim? Recommended: a smoke redock on 5 Astex cases with symmetric RMSD and 3 seeds, labelled implementation sanity. The 40-replicate PoseBusters campaign is D9 and out of sprint scope.
4. **E_search.** PHD-V2-07 was not read. Does it define an out-of-box term in E_search? This must be settled before 4.8 merges (C1).
5. **−0 in the box.** Should −0 be canonicalized at SearchRegion construction (allowed by the research only as explicit input normalization), or kept distinct (C2)?
6. **Direct-versus-grid threshold.** AccSpec leaves the D3 approximation threshold to the owner [AT-0103 v1.2]. 4.7/4.8 need a number.
7. **Meeko version.** Downgrade to 0.7.1 to match the comparator, or keep 0.8.0 and treat the 0.7.1 lane as the comparator only?
8. **Generated chemistry.** Should a "generated chemistry" profile (PROPKA, Dimorphite, Meeko torsion tree) get a named, versioned profile ID? The research allows this only as a separately validated non-core profile [AT-0068, 0075].
9. **Model and altloc defaults.** Should model 1 and the max-occupancy altloc remain defaults with an acknowledgement, or become AMBIGUOUS blocks per AT-0047/0048?

Not read in part 1: PHD-V2-03..14 (now covered in section 8), the plans (skipped on purpose). R01 was read for scoring, search and RMSD
only. R03-14 covers PyMOL-selection implementation and is of low docking relevance; its rule is "open an OPEN_QUESTION, never change
the oracle to pass tests" [R03-14 §8].

## 7. Owner decisions (2026-10-09)
- Q1 Preview capability: **separate EXPERIMENTAL capability** (VINA_COMPARATOR_PREVIEW). DOCKING.RUN stays UNAVAILABLE until D8. Docking on PREVIEW_UNQUALIFIED preparations is allowed, labelled.
- Q2 Store: **interim deviation accepted** (file store), recorded as an ADR; keep the store swappable for SQLite WAL.
- Q3 Redock bar: no presentation-driven claim; follow the research at our own speed. The redock is labelled smoke (implementation sanity), never validated.
- Q5 -0 in the box: **normalise at SearchRegion input** (explicit, geometry only); the hash encoder stays bit-exact.
- Still open after part 1: Q4, Q6, Q7, Q8, Q9. Part 2 status is in section 8.5: Q4 answered by research, Q9 answered by research (owner confirms), Q8 sharpened, Q6 and Q7 still owner decisions.

## 8. From PHD-V2-03..14

Read: PHD-V2-03, 04, 05, 06, 07 (in full), 09, 10, 11, 13 (in depth); 08, 12, 14 (only where relevant to the tasks). All are "implementation
authority: NONE / HOLD until PHD-V2-15". So they define what the science must be, not permission to ship a claim.

### 8.1 Key facts

**Search objective (closes Q4)** [PHD-V2-07 §1, §8, §9]
- `E_search = E_inter + E_intra_nonbonded`. Both terms are PHD-V2-06 scorer outputs (ME_DOCKING_V1_VINA_CLASSIC_1_0). No new physical term.
- Excluded from E_search: the torsion divisor, preparation force-field/conformer energy, **box/barrier energy**, reference RMSD, hidden clash penalties beyond E_intra, and ML/rerank terms.
- DockingScore stays `E_inter/(1+0.05846·N_tors_vina)`. It is never the search objective, and E_search is never the ranking score [PHD-V2-09 §23 Q20-21].
- The older "out-of-box penalty" language (P1-R13, P2-S05) is explicitly SUPERSEDED [PHD-V2-07 §3]. Vina's out-of-grid penalty and capped "hunt" objective are deliberately not inherited.

**SearchRegion** [PHD-V2-05 §1, §6, §11, §12, §16]
- Rule ALL_LIGAND_HEAVY_ATOMS_IN_CLOSED_REGION_V1: after the full pose is realized (torsions, then rigid body), every heavy atom must satisfy `min ≤ x ≤ max` on all axes. On a face is inside. Hydrogens do not count. The result does not depend on the root.
- Outside: inadmissible. Never clipped, projected, wrapped, auto-enlarged or penalized. Status SEARCH_REGION_BOUNDARY_VIOLATION / SEARCH_POSE_OUTSIDE_REGION.
- A floating-point tolerance must not enlarge the closed set.
- SearchRegion (what poses are admissible) and ScoringFieldDomain (where the field can be evaluated) are separate. Required: ScoringFieldDomain ⊇ every admissible coordinate plus the interpolation stencil.
- Preflight feasibility is PROVEN_FEASIBLE, PROVEN_IMPOSSIBLE or UNKNOWN. No invented ligand-size cutoff.

**Grid and field** [PHD-V2-06 §12-13, §16]
- The direct pairwise scorer is the oracle. The grid (ME_VINA_GRID_V1_1_0) is the production path.
- Grid: h = 0.375 Å, origin = Smin − h, `Ncells = ceil((Smax−Smin+2h)/h)`, points = Ncells+1. Halo = one h per axis. The SearchRegion is never snapped.
- Per-term, type-conditioned channels. Weights are applied after interpolation.
- Gradient: analytic per cell, piecewise linear and discontinuous at cell faces. No smoothness claim.
- At r = 0 the score is finite but the gradient is invalid (a flag, never an invented direction).
- Outside the ScoringFieldDomain: INVALID / SCORING_FIELD_OUT_OF_DOMAIN. No zero, no extrapolation, no direct fallback, no grid growth.
- Logical field = 80 channels (16 XS × 5 terms), with 59 physical arrays allowed only for proven-zero channels [PHD-V2-13 amendment v1.1].
- Reference arithmetic: binary64, stable AtomUID pair order, Neumaier summation per term.

**Search and optimizer** [PHD-V2-07 §5-19]
- Pose: C = (t, q, φ1..φN), dimension 6+N, rigid receptor. Body origin o0 = heavy-atom centroid of the starting conformer, so `r_i = t + R(q)(y_i(φ) − o0)` does not depend on the root.
- Representation: φ wraps to [−π, π) (+π serializes as −π). q is stored (w,x,y,z) with the w > 0 representative and updated through an exponential-map 3-vector, never as 4 free components.
- Initialization: Shoemake orientation; torsions U[−π, π); translation uniform in the exact feasible per-axis interval `[Smin−min z, Smax−max z]`. If the ligand does not fit, resample (at most G attempts), then SEARCH_INITIALIZATION_EXHAUSTED. The crystal pose is never read.
- Global move: pick one entity uniformly from {T, R, φ1..φN}. Translation +2.0 Å × unit-ball vector; rotation (2.0/Rg) × unit-ball vector, with Rg = heavy-atom gyration radius about o0; torsion full reset U[−π, π).
- An out-of-box proposal is rejected unscored and still consumes the step. Every admissible proposal is BFGS-refined, then Metropolis with T = 1.2 (equal energies accepted). The first eligible minimum is accepted unconditionally.
- BFGS: H0 = I; Armijo c1 = 1e-4, α0 = 1, factor 0.5, at most 10 trials.
  - An out-of-box trial is not scored: halve α. All 10 out of box: BOUNDARY_BLOCKED. Feasible trials but none passes Armijo: LINE_SEARCH_FAILED.
  - Converged when ‖g‖₂ < 1e-5 on the new gradient. At most L = ⌊(25+A)/3⌋ iterations, else MAX_ITERATIONS (still eligible). If sᵀy ≤ 0 or unresolved, reset H = I.
- Gradient chain rule (g_i = ∂E/∂r_i): `g_t = Σ g_i`; `g_ω = Σ (r_i − t) × g_i`; `g_φj = a_j · Σ_{i∈M_j} (r_i − p_j) × g_i`.
- Budget: G = 105·(50 + A + 10(6+N)), MAX_EVAL = G(1+10L). E trajectories (default 8, at most 256), with E·MAX_EVAL ≤ 1e9 [PHD-V2-13 §PERF-REQ-028]. No early stop or wall-clock stop. Each trajectory emits one best eligible minimum; clustering is downstream.

**RNG** [PHD-V2-07 §17]: Philox4x32-10, key = uint64 seed (low word, high word). Counter = (block low, block high, trajectory_id, domain_id), with fixed domains 1-8 (INIT_ORIENTATION … ACCEPTANCE). `u = x·2⁻³²`. No normal distribution and no stdlib distributions.

**Pose processing** [PHD-V2-09 §8-16, §23]: profile ME_DOCKING_V1_POSE_POSTPROCESS_1_0.
- RMSD: direct by AtomUID, plus symmetric (minimum over exact automorphisms). Receptor frame, heavy atoms, no fit, no Hungarian or nearest-element mapping.
- Plausibility gate ME_POSE_PLAUSIBILITY_VDW_0_75_V1_1_0: every ligand/receptor heavy pair needs d ≥ 0.75(r_i + r_j), boundary inclusive. A failing pose is stored but ineligible for clusters. The score is never changed; the radii table is versioned with no carbon fallback.
- Clustering ME_DOCKING_V1_CLUSTER_SYM_RMSD_2A_BESTFIRST_1_0: representative-radius, best-first, 2.0 Å inclusive, no single-link merge, no centroid pose.
- Ties: Q_score = roundTiesToEven(score/1e-6), then trajectory ordinal. Final modes (ME_DOCKING_V1_FINAL_MODES_9_ERANGE3_1_0): at most 9, within best + 3.0. No cross-state "best protomer/tautomer" pick.

**Provenance and replay** [PHD-V2-10 §1, §6, §11-15]
- Six layers: source bytes, scientific content, lineage, audit, cache, replay.
- Never in scientific identity: timestamps, host, PID, temporary paths, UI or camera state.
- Hashing: ME_CANONICAL_CBOR_V1_1_0 plus SHA-256 with domain separation; F64Bits keeps −0 distinct; NaN/Inf rejected; no rounding to stabilize hashes. This confirms owner decision Q5: normalize −0 at SearchRegion input, never in the encoder.
- RNGProvenance: profile and digest, master seed, seed_origin USER | OS_CSPRNG, E, trajectory ids, domain map, consumed blocks per (trajectory, domain), bounded counts, status.
- A retry is a new ExecutionAttemptId. Cancelled attempts are diagnostic only. There is no checkpoint/resume.
- The environment fingerprint is split into numerically material fields (commit, dirty-tree digest, compiler and flags, ISA/SIMD, FTZ/DAZ/FMA, dependency lock, profile digests) and audit-only fields (time, host, memory). It must never hold secrets or personal absolute paths.

**Ligand kinematics** [PHD-V2-04 §14, §19.3, §31-32]
- A rotor is an acyclic, non-aromatic, localized single bond whose cut separates the graph, that is not in the rigid-motif library, and that moves heavy atoms.
- The rigid-motif library covers amide, urea, carbamate, sulfonamide, thioamide and amidine/guanidinium; element pairs alone are not enough.
- Terminal H-only rotors are not search DOFs. search_torsion_count ≠ N_tors_vina/TORSDOF.
- The root uses a named deterministic policy: candidate = largest rigid fragment, then centrality, then AtomUID. Re-rooting changes KinematicModelHash, never the chemical identity.
- Macrocycles and covalent docking are UNSUPPORTED.

**Receptor state (answers Q9)** [PHD-V2-03 §9-11, §18 REC-D02/D03/D04/D10]
- Model: one admissible model may be auto-selected (recorded). With more than one model, never silently take model 1: RECEPTOR_MODEL_SELECTION_REQUIRED → AMBIGUOUS until an explicit selection, which yields a new PreparedReceptorState hash.
- Assembly: never silently take assembly 1.
- Altlocs: COHERENT_MAX_OCCUPANCY_V1 only when a coherent group has a unique maximum. Ties, partial labels or coupled alternatives → RECEPTOR_ALTLOC_AMBIGUOUS. No per-atom mixing.
- His: explicit per residue. A material site ambiguity → RECEPTOR_HISTIDINE_AMBIGUOUS.
- Site relevance uses SiteInfluenceRequirement: the SearchRegion envelope dilated by 8.649519052838329 Å, not "8 Å from centre" [PHD-V2-05 §12; PHD-V2-08 §29 Q3-4]. This sharpens C8.

**Comparator (Q7 context)** [PHD-V2-11 §19]
- Two lanes: controlled-input (engine core) and package-native (Meeko 0.7.1 f4a8c1e + Vina 8eb4040).
- Frozen Vina fields include num_modes = 9, energy_range = 3.0, a box identical to the SearchRegion, and PDBQT digests.
- A newer Meeko or Vina version needs a new comparator profile digest.

### 8.2 Replacement spec for task 4.8: "Search-ready field: gradients and hard SearchRegion"
Replaces the clamp/slope design, which the research rejects [PHD-V2-07 §3, §8, §13; PHD-V2-05 §1; PHD-V2-06 §13.6].
1. **Field gradient.** `evaluate_with_gradient(x)` returns each raw term channel's value and its analytic trilinear ∂/∂x,y,z, using the same 8 corners and the cell-selection rule of [PHD-V2-06 §13.3]: on a grid plane, take the higher cell when one exists.
   - Weights are applied after interpolation.
   - Return a per-term decomposition plus the weighted total.
2. **No out-of-box term.** E_search has no box, barrier or slope term, and no clamped or extrapolating mode may exist in the canonical path.
   - Outside the ScoringFieldDomain (or with an incomplete stencil): return INVALID SCORING_FIELD_OUT_OF_DOMAIN.
   - Keep the strict mode. Delete the "clamped mode" item.
3. **Admissibility check.** Add a separate `search_region_admissible(heavy_atoms, region)`: closed AABB, all heavy atoms, hydrogens ignored, no epsilon. It returns SEARCH_POSE_OUTSIDE_REGION.
   - It runs *before* any field call. Callers (initializer, mutation, line search) reject the pose unscored; the line search halves α, giving BOUNDARY_BLOCKED after 10 trials.
   - Test the invariant: any admissible pose implies every heavy-atom stencil is inside the ScoringFieldDomain. An out-of-domain result for an admissible pose is an invariant failure that aborts the attempt.
4. **Gradient validity.** At r = 0 in the direct path, report a finite score with gradient_valid = false (INVALID_GRADIENT). Non-finite values → SEARCH_OBJECTIVE_NONFINITE. Never zero, never perturbed.
5. **Tolerances.**
   - Analytic versus central finite difference: a sanity test only, at points away from cell faces (the gradient is discontinuous there). Use relative error ≤ 1e-6 with a declared step.
   - Grid backend versus scalar reference: interpolated term abs ≤ 1e-10, gradient abs ≤ 1e-8 / rel ≤ 1e-7 componentwise [PHD-V2-13 §PERF-REQ-062, 064].
   - PHD-V2-13 writes the gradient rule as "OR" in §47 but "and" in PERF-REQ-064. Use the stricter "and" until the owner says otherwise.
   - Face-boundary classification must be exact.

   Done when: 10k random interior points pass; face and corner points pick the documented cell; every out-of-domain query is INVALID; a pose exactly on a face is admissible; a pose at max + 1 ulp is inadmissible.

### 8.3 Research requirements for 8.1 (D4 part 1: ligand movement model)
- **Input** is a sealed LigandKinematicModel [PHD-V2-04 §18.6]: rigid fragments, rotor edges (axis AtomUIDs), moving sets, reference dihedrals, root, branch order and provenance. The rotor rules and rigid motifs are listed in 8.1.
  - Build it from the D3 topology with a *named* deterministic root policy.
  - Never take Meeko or PDBQT ROOT/TORSDOF as truth; that is evidence only, with differences recorded.
- **Pose → coordinates**:
  1. apply the torsions in tree order to get y_i(φ);
  2. compute `u_i = y_i − o0`, with o0 = heavy-atom centroid of the starting conformer;
  3. compute `r_i = t + R(q)u_i`.
  - Results must be the same for re-rooted equivalent models [PHD-V2-07 §5, AT-012].
  - q and −q must give identical coordinates. Zero or non-finite q fails.
- **E_intra_nonbonded** uses the same five Vina-classical terms on heavy-atom XS centres as a separate channel, never in DockingScore [PHD-V2-06 §11, REQ-045].
  - *Gap:* PHD-V2-06/07 do not pin the intraligand pair-exclusion rule (the backlog's "more than 3 bonds apart") or the intra cutoff. Take them from the pinned Vina 1.2.7 `model.cpp`, record them as an explicit profile rule, and flag this to the owner. Do not invent them.
- **Derivatives** use the chain rule in 8.1, with gradients from E_inter + E_intra. The dimension is 6+N, and rigid ligands keep 6.
- **Tests (done when)**:
  - SEARCH-FX-001..006, 011-015 and 019 analogues: 1-atom (Rg = 0), diatomic, 1-, 3-torsion and branched ligands; quadratic, periodic, rotation-only and translation-only toys; and r = 0.
  - Pose → coordinates → pose round trip: the 1e-10 Å component tolerance is the primitive-transform bound [PHD-V2-13 §PERF-REQ-063]. "Exact" holds only for the canonical (wrapped, w > 0) representation.
  - Amide/sulfonamide not rotors; terminal methyl/hydroxyl not DOFs.
- **Open:** what A = n_movable_atoms counts (heavy atoms only, or including H) is not defined in PHD-V2-07. It changes G and L, so it needs an owner decision before search budgets are coded.

### 8.4 Research requirements for 5.8 (provenance)
- **manifest.json** = an interim DockingReplayManifestV1 subset [PHD-V2-10 §15]. It contains:
  - source artifact SHA-256 and conversion/loss records;
  - prepared receptor/ligand state digests and the preparation profile id + digest;
  - the SearchRegion as min/max;
  - scoring, grid and search profile ids (or "external Vina 1.2.7 8eb4040" for the comparator preview);
  - capability axes (8.5 Q1);
  - RNGProvenance (seed, seed_origin, engine seed mapping as in C13);
  - the material environment fingerprint and an audit block kept separately;
  - output digests, final status and requested reproducibility class.
- No timestamps or host data inside the scientific digest. No secrets, no environment dump, no absolute personal paths [PHD-V2-10 §14].
- A retry gets a new attempt id and never overwrites. Cancelled runs are never published as results [PHD-V2-10 §13].
- **Done when** a same-machine replay is classed honestly. With Vina's own RNG and multithreading, claim EXACT_EXECUTION_REPLAY only if the output digests match. Otherwise report the weaker class it actually passes, never a silent downgrade [PHD-V2-10 §11-12].
- Hash the manifest with the canonical CBOR profile once 2.8 lands. Until then, label the hash as an interim (non-canonical) digest.

### 8.5 Open-question status (updates section 6)
- **Q4 E_search: ANSWERED** [PHD-V2-07 §8]. It is E_inter + E_intra_nonbonded and has no out-of-box term. Conflict C1 is resolved by the spec in 8.2, which unblocks 4.8.
- **Q6 direct-versus-grid threshold: STILL OPEN, sharpened.**
  - PHD-V2-06 makes the same-pose direct/grid differential mandatory (total and per term, over fractional coordinates and boundaries), but delegates the number to PHD-V2-11 [PHD-V2-06 AT-034, §27].
  - PHD-V2-11 sets none. The PHD-V2-13 amendment says explicitly that "no direct-versus-grid numerical threshold … is set" [PHD-V2-13 v1.1].
  - The 1e-10 tolerances compare a grid backend with the grid reference, not grid with direct.
  - So 4.7/4.8/4.9 must *record* the direct-versus-grid error distribution (max/p95 per term and total, plus search-outcome sensitivity [PHD-V2-07 §29]) and must not set a pass bar. The owner picks the number.
- **Q7 Meeko: owner decision, sharpened.** The research needs Meeko 0.7.1 only for the package-native comparator lane [PHD-V2-11 §19.2]. Keeping 0.8.0 for our own preparation is compatible if labelled.
- **Q8 generated chemistry: SHARPENED.**
  - Generation (protomers at an explicit target_pH, tautomers, opt-in stereo enumeration, conformers, minimization, rotor perception) is legitimate only under a *named, versioned profile* that records the tool, version, rules, pH, caps and pruning, and creates separate ChemicalStates [PHD-V2-04 §17, §32 items 7-16; PHD-V2-03 §19].
  - The research names PRESERVE_SUBMITTED_STATE but defines no generator profile ID. Concrete generator profiles are left to PHD-V2-11/15.
  - Recommendation: give our PROPKA/Dimorphite/Meeko pipeline its own profile id + digest, status EXPERIMENTAL / NOT_EVALUATED. That id is an owner decision.
- **Q9 model/altloc defaults: ANSWERED by research** [PHD-V2-03 REC-D03/D04]. "Default plus acknowledgement" is not allowed:
  - a single model may be automatic;
  - multiple models → AMBIGUOUS until an explicit user choice;
  - altlocs need a coherent unique maximum, and ties → AMBIGUOUS.
  - Owner to confirm, so that C9 becomes a task.
