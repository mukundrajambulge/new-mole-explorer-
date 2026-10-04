# Profile omission root cause

## Finding

The predecessor stopped before accepting a receptor graph because its exact v1.0 altloc allowlist contained only MET106 and GLU108. The fail-closed residue validator rejected every alternate atom at any other polymer position. This was an intentionally closed profile scope, not a source-file loss or an omission from the receptor's explicit chemical-state table. The source has exactly five polymer altloc sites: ASN68, ASP72, ARG76, MET106, and GLU108. No fourth site was found.

All three newly identified residues exist in the exact selected source conformer: 3DMX model 1, polymer entity 1, label/auth chain A. The byte-verified source has a complete 164-position entity sequence. The original 51-side-chain inventory is an ionizable-site inventory: ASN68 is correctly absent from that ionizable list, while ASP72 and ARG76 are correctly present and already explicitly assigned.

## Residue findings

| Residue | Source atom inventory (all atoms are heavy) | Altloc evidence | Missing atoms | Distance to BNZ | Local source environment | State sensitivity and cause |
|---|---|---|---|---:|---|---|
| ASN68 | Common `N,C,O`; A/B pairs for `CA,CB,CG,OD1,ND2`; selected inventory 8/8 | A 0.70, B 0.30; coherent atom-name sets, unique A maximum | None | 18.094552 Å nearest atom | In A, ND2–HOH1089 O 3.163342 Å and OD1–GLN69 N 3.995579 Å. In B, ND2–HOH1089 O 2.326949 Å, ND2–HOH1126 O 2.670240 Å, and OD1–PHE4 CE1 2.725010 Å. | ASN68 is neutral and not one of the 51 ionizable side chains. Its amide donor/acceptor assignment is atom-name-specific (ND2 donor, OD1 acceptor). A/B are distinct source conformers, so a coordinate choice was needed; the profile had no ASN68 altloc row. No OD1/ND2 swap or heavy-atom flip is needed or performed. |
| ASP72 | Common `N,C,O`; A/B pairs for `CA,CB,CG,OD1,OD2`; selected inventory 8/8 | A 0.80, B 0.20; coherent atom-name sets, unique A maximum | None | 13.740000 Å nearest atom | In A, the nearest reported carboxyl contacts are OD1–ARG76 CD 4.190389 Å and OD1–ARG76 CG 4.239756 Å. In B, OD1–ASN68 OD1(A) is 2.863438 Å and OD1–ASN68 O is 2.908577 Å. | ASP72 is state-sensitive, but AUTH04 already assigns ASP72 deprotonated (−1) at its pH 6.9 proxy. The omission is only its alternate-coordinate disposition, not its chemical state. |
| ARG76 | Common `N,C,O`; A/B pairs for `CA,CB,CG,CD,NE,CZ,NH1,NH2`; selected inventory 11/11 | A 0.60, B 0.40; coherent atom-name sets, unique A maximum | None | 10.975264 Å nearest atom | In A, CG–ASP72 O is 3.245328 Å and CB–ASP72 O is 3.350594 Å. In B, NH2–ASP72 OD1(A) is 2.568831 Å and CG–ARG80 NH1 is 3.310279 Å. | ARG76 is state-sensitive, but AUTH04 already assigns ARG76 protonated (+1) at its pH 6.9 proxy. The omission is only its alternate-coordinate disposition, not its chemical state. |

The local-contact distances are descriptive source geometry, not a newly introduced protonation predictor or a selection criterion. BNZ distances and complete A/B row-level atom evidence are in `runtime_logs/linux/source-altloc-distance-audit.json` and `runtime_logs/linux/source-altloc-preflight.json`. The all-residue atom-site and hydrogen-state mapping is in `SOURCE_PROFILE_COMPLETENESS_MATRIX.csv`.

## Why the validator stopped

The original `create_residue_inventory` implementation had a profile-specific branch for positions 106 and 108 and rejected any alternate at every other position. Therefore the first unexpected ASN68 `CA` row was correctly rejected before a selected receptor heavy-atom graph was accepted. It did not silently choose, average, or discard conformers. The 51-site chemical-state proposal did not omit ASP72 or ARG76; ASN68 is not ionizable and was not meant to appear in that count. The missing profile entries were the three residue-local alternate-coordinate dispositions.

The bounded owner instruction in `PROFILE_CORRECTION_AUTHORIZATION.md` now authorizes adding these exact three coherent A selections only because each source group is complete and has a unique maximum occupancy, and because the explicit chemical states for ASP72 and ARG76 were already approved. All other alternates remain rejected unless listed. Historical v1.0 and pre-correction HOLD evidence is preserved.
