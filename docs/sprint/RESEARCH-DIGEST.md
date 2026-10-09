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

AccSpec cites PHD-V2-06/07/09/10/11/13. Those documents were not in the reading list, so exact equations they own (for example E_search
and the line-search constants) are named here only where AccSpec states them.

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

**4.8 gradients and out-of-box behaviour**
- Gradients are defined in 6+N generalized coordinates [AT-0111].
- Out-of-box poses are inadmissible. They must not be clipped, wrapped, projected or given a hidden score penalty, and this status is distinct from SCORING_FIELD_OUT_OF_DOMAIN [AT-0083..0085].
- The field domain covers every admissible coordinate plus the interpolation halo [AT-0091].
- R01 adds: hard constraints and penalties are "not scientifically equivalent" and need separate specification [R01 §14].

**8.1 movement model and search**
- Explicit sealed torsion tree: root and branch order are inputs, never chosen by the engine [AT-0072..0075].
- Rings, amides and terminal-H rotors stay rigid [AT-0073, 0074].
- Search: Vina-family Monte Carlo / basin-hopping [AT-0112].
- Local optimizer: full-memory BFGS with Armijo backtracking [AT-0113, 0114], minimizing E_search, not DockingScore [AT-0115].
- Initial orientation: Shoemake quaternion [AT-0121].
- Budget: G = 105·(50+H) with H = A + 10(6+N); L = ⌊(25+A)/3⌋; MAX_EVAL = G(1+10L); E·MAX_EVAL ≤ 1e9 [AT-0123..0126].
- Exhaustiveness: default 8, maximum 256 [AT-0122].
- RNG: Philox4x32-10, uint64 master seed (0 is valid), streams addressed by trajectory and purpose, never by thread [AT-0116..0120].

**5.8 provenance and replay**
- Bind: states and their hashes, profile IDs and digests, seed/PRNG/stream policy, build, environment fingerprint, budget, output hashes, score semantics, evidence status and claim policy [V2-01 §20; AT-0154, 0155, 0158; R15 §9].
- Retries never overwrite earlier records [V2-01 §20].
- Cache keys include every material parent digest. Corrupted entries are quarantined [AT-0159, 0161].

**2.8 (-0 versus 0 in the digest)**
- Scientific hashes use ME_CANONICAL_CBOR_V1_1_0 with SHA-256 framed envelopes, not the viewer's canonical-JSON profile [AT-0151, 0153].
- Binary64 values use exact F64Bits, *including signed zero* [AT-0152]. CBOR golden vectors include signed-zero cases [INT-FX-017], and weighted −0.0 is preserved bit-exactly [AT-0103 v1.1].
- So the research does not allow −0 ≡ 0 at the encoding layer.
- Box bounds are canonical min/max, and center/size are derived full extents, never half-extents [AT-0081].

## 5. Conflicts

1. **[blocker] 4.8 out-of-box rule.** The backlog says atoms leaving the box are "pushed back, not rejected", with a slope penalty. The research forbids clipping/projection and hidden penalties, and says out-of-box poses are inadmissible [AT-0084]. Recommendation:
   - A penalty may exist only as an explicit, profile-versioned term of E_search (taken from PHD-V2-07, which must be read first).
   - Every terminal candidate is checked for admissibility (all heavy atoms inside the closed box), and inadmissible candidates are rejected.
   - The penalty never enters DockingScore.
   - Keep BOX_INADMISSIBLE separate from SCORING_FIELD_OUT_OF_DOMAIN.
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

Not read: PHD-V2-03..14 (cited by AccSpec, but not in the list), the plans (skipped on purpose). R01 was read for scoring, search and RMSD
only. R03-14 covers PyMOL-selection implementation and is of low docking relevance; its rule is "open an OPEN_QUESTION, never change
the oracle to pass tests" [R03-14 §8].
