# Alternate and component policy freeze

All dispositions below are a versioned profile proposal. The source record itself remains intact and recoverable by its source artifact digest. No generic record deletion is authorized.

## Alternates

| Residue | Deposited alternatives | Proposed receptor state | Evidence and rationale |
|---|---|---|---|
| MET106 | A 0.70; B 0.30 | Select coherent A plus common blank atoms; exclude B from the derived receptor state | Both alternatives are 7.9205/8.0028 Å minimum distance to BNZ. A is the unique higher-occupancy conformer under COHERENT_MAX_OCCUPANCY_V1. |
| GLU108 | A 0.70; B 0.30 | Select coherent A plus common blank atoms; exclude B from the derived receptor state | Both alternatives are 7.6341/7.6590 Å minimum distance to BNZ. A is the unique higher-occupancy conformer under COHERENT_MAX_OCCUPANCY_V1. |

Do not combine A atoms from one alternative with B atoms from another within a residue, average coordinates, normalize occupancies, or rewrite source coordinates. Preserve every source atom-site occurrence, altloc label, occupancy, source row identity, and selected/excluded mapping. The residue sites are remote from the BNZ heavy-atom envelope and show the same unique A maximum. A preparation runner must independently verify that each atom group is coherent, that all common blank atoms are retained exactly once, and that no tie or missing mapped atom exists; otherwise stop.

## Waters

- Source inventory: 248 water occurrences.
- CORE_DRY_V1 scoring receptor: exclude every water, recording each source occurrence and the named dry-core rule as its reason.
- HOH1147: explicitly record the near-site exclusion. Its minimum distance is 7.8253 Å to BNZ C2 and its closest reported receptor atom is Val87 CG2 at 3.2703 Å. DEC04 found no bridge/contact. Its exclusion removes a possible solvent contribution and is a profile choice, not proof that waters never matter.
- Retain all water source records and coordinates in immutable source provenance. Do not use “remove all waters” as a source-edit command or erase water evidence.

## Non-polymers and reference ligand

| Occurrence | Source role | Minimum distance to BNZ | CORE_DRY_V1 disposition |
|---|---|---:|---|
| HED, label asym E, auth chain A, residue 904 | crystallization additive/buffer | 10.8478 Å | Exclude from receptor; record component occurrence, source identity, role evidence, and explicit exclusion. |
| HED, label asym F, auth chain A, residue 905 | crystallization additive/buffer | 11.6196 Å | Exclude from receptor; record as above. |
| PO4, label asym B, auth chain A, residue 901 | crystallization buffer | 15.3395 Å | Exclude from receptor; record occurrence and role. |
| PO4, label asym C, auth chain A, residue 902 | crystallization buffer | 20.1564 Å | Exclude from receptor; record occurrence and role. |
| CL, label asym D, auth chain A, residue 903 | crystal-associated ion | 32.5330 Å | Exclude from receptor; record occurrence and role. |
| BNZ, ligand occurrence | reference ligand, not receptor | — | Remove only from receptor graph with explicit receptor-versus-ligand role; preserve the source occurrence and map it to the ligand state. |

No metal/cofactor is reported within 8 Å of BNZ. No generic HETATM filter is permitted. If the runner encounters an unlisted non-polymer or an occurrence with ambiguous role, stop for explicit disposition.

## Prepared-state interpretation

The derived receptor represents the declared polymer receptor in a dry-core scoring component policy, with coherent major A conformers and the proposed explicit chemical state. It is not the complete crystallographic contents and does not claim that omitted water/additives were absent from the experiment. D2's ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0 remains the consumer/component profile; the preparation profile supplies one provenance-bearing realization of it.

## Owner decision status

The coherent MET106/GLU108 A-altloc policy and occurrence-level CORE_DRY_V1 component dispositions are OWNER APPROVED — YES under AUTH04-03; see `OWNER_AUTHORIZATION_RECORD.md`. This approval remains single-fixture and development-only.
