# Source/profile mismatch: additional receptor alternate conformers

**Current disposition (2026-10-05): RESOLVED under the bounded continuation authorization.** Profile v1.1 explicitly dispositions ASN68, ASP72, and ARG76. The source/profile validator, preparation, D2 seals, SearchRegion, and fixture full-pose run all pass. The hard stop below is the correct historical v1.0 result and remains preserved.

**Historical evidence note:** the hard stop below records the correct v1.0 disposition before the bounded owner-authorized correction. The mismatch is resolved for profile v1.1 in the continuation addendum at the end of this file; the earlier source rows, policy analysis, and stop evidence remain unchanged.

**Disposition:** hard stop before constructing or supplying a fixture molecule to RDKit.

The exact source hash gate passed for all six DEC04 artifacts on Windows and WSL2. The hash-checked 3DMX mmCIF contains three additional A/B polymer alternate groups in entity 1, chain/asym A, model 1, beyond the only groups named by the owner-approved candidate profile (`MET106` and `GLU108`). The source alternatives have unique maximum occupancy A, but the profile explicitly limits its resolved selection to MET106/GLU108. Applying the same rule to these new groups would alter the authorized coordinate-state selection and profile content.

| Residue | Atom-site rows with alternates | A occupancy | B occupancy | Profile status |
|---|---:|---:|---:|---|
| ASN68 | 5 (`CA`, `CB`, `CG`, `OD1`, `ND2`) | 0.70 | 0.30 | Not authorized |
| ASP72 | 5 (`CA`, `CB`, `CG`, `OD1`, `OD2`) | 0.80 | 0.20 | Not authorized |
| ARG76 | 8 (`CA`, `CB`, `CG`, `CD`, `NE`, `CZ`, `NH1`, `NH2`) | 0.60 | 0.40 | Not authorized |
| MET106 | 5 | 0.70 | 0.30 | A plus common atoms approved |
| GLU108 | 6 | 0.70 | 0.30 | A plus common atoms approved |

The source has 1,335 model-1 entity-1/chain-A polymer atom-site rows and a complete 164-position entity sequence. The preflight inventory encountered ASN68 first and rejected its alternate state before accepting a receptor atom graph. No state was silently selected, mixed, averaged, or omitted. The full row-level preflight, including source row IDs, occupancies and source hashes, is `runtime_logs/linux/source-altloc-preflight.json`.

AUTH04's pinned adapter proposal specifies “common blank-altloc atoms and the coherent A conformer for MET106 and GLU108 only,” and directs the runner to reject unlisted state/input identities. The owner authorization approves the exact proposal and forbids scope expansion. The source-only geometry audit below was computed from the byte-hash-verified source buffers without importing RDKit or constructing molecules; full per-atom distances are in `runtime_logs/linux/source-altloc-distance-audit.json`.

The D2 contract type `D2AltlocResolution` exposes policy labels including `COHERENT_MAX_OCCUPANCY_V1` (`packages/contracts/src/docking/d2.ts`, lines 175–180), but it does not supply a fixture default or broaden AUTH04's exact selected-group list. The owner-approved preparation profile and pinned adapter proposal bind the candidate-specific selection to MET106/GLU108. Merely having a reusable policy enum does not authorize extending this profile to ASN68/ASP72/ARG76.

| Residue | Occupancy A/B | Nearest A-or-B heavy atom to BNZ | Maximum matched A↔B atom displacement | Within 8 Å of BNZ |
|---|---|---:|---:|---|
| ASN68 | 0.70 / 0.30 | 18.094552 Å | 3.172592 Å | No |
| ASP72 | 0.80 / 0.20 | 13.740000 Å | 3.115450 Å | No |
| ARG76 | 0.60 / 0.40 | 10.975264 Å | 5.283865 Å | No |

These distances place the groups outside the 8.0 Å pair-interaction cutoff, but do not remove them from the full receptor heavy-atom identity or select one coordinate state. No scoring irrelevance is used to omit source atoms or to assert profile equivalence.

The controlling profile sources specify the only resolved altlocs as MET106 and GLU108: `verification/d3-prep-auth-04/PINNED_TOOLCHAIN_PROPOSAL.md`, `PREPARATION_PROFILE_FREEZE.md`, and `ALTERNATE_COMPONENT_POLICY_FREEZE.md`. The runtime-unblock continuation also forbids changing the alternate policy. Consequently:

- no fixture graph reached `Chem.AddHs`;
- no prepared receptor or ligand state, profile digest, D3 envelope, or SearchRegion was sealed;
- replay and full-pose scoring did not begin;
- D3-CLOSURE-EXEC-01 remains on HOLD for this concrete source/profile scientific-state conflict.

The exact-version Linux RDKit runtime and synthetic AddHs dry-runs passed independently. The source-only geometry audit imported no RDKit modules. Windows Application Control remains unchanged, and the historical Windows failure evidence is preserved.

## Continuation resolution under bounded owner authorization

The owner continuation dated 2026-10-04 authorizes one profile-completeness correction for ASN68, ASP72, and ARG76 when the exact source and already approved state rules uniquely support the required disposition. The attachment SHA-256 and exact scope are recorded in `PROFILE_CORRECTION_AUTHORIZATION.md`.

The 164-residue, source-only profile validator found exactly five altloc sites and no additional omitted site. ASN68 has complete A/B atom sets at 0.70/0.30, ASP72 at 0.80/0.20, and ARG76 at 0.60/0.40. Each has one coherent, unique occupancy maximum A, with all common atoms retained. ASP72− and ARG76+ were already explicit in the approved 51-side-chain state table; ASN68 is a neutral CCD amide, not an ionizable member of that table. No side-chain atom swap or heavy-atom movement was performed.

Profile v1.1 now lists all five exact groups. The same fail-closed inventory validator passed all 164 source residues, 1,306 selected receptor heavy atoms, 51 explicit side-chain states, both termini, and all 418 component occurrences before RDKit import. There is no fourth omission. See `CORRECTED_PREPARATION_PROFILE.md`, `PROFILE_OMISSION_ROOT_CAUSE.md`, and `PROFILE_COMPLETENESS_VALIDATION.md` for the full correction and matrix-backed audit.
