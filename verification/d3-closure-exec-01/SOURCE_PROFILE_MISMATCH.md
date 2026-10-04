# Source/profile mismatch: additional receptor alternate conformers

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

The controlling profile sources specify the only resolved altlocs as MET106 and GLU108: `verification/d3-prep-auth-04/PINNED_TOOLCHAIN_PROPOSAL.md`, `PREPARATION_PROFILE_FREEZE.md`, and `ALTERNATE_COMPONENT_POLICY_FREEZE.md`. The runtime-unblock continuation also forbids changing the alternate policy. Consequently:

- no fixture graph reached `Chem.AddHs`;
- no prepared receptor or ligand state, profile digest, D3 envelope, or SearchRegion was sealed;
- replay and full-pose scoring did not begin;
- D3-CLOSURE-EXEC-01 remains on HOLD for this concrete source/profile scientific-state conflict.

The exact-version Linux RDKit runtime and synthetic AddHs dry-runs passed independently. Windows Application Control remains unchanged, and the historical Windows failure evidence is preserved.
