# 3DMX/BNZ chemical-state decision proposal

Status: owner-approved proposal for one development-only state; not prepared.

## Evidence classes

| Item | Evidence class | Proposed record |
|---|---|---|
| 3DMX model 1, assembly 1 monomer A1, chain/asym A, 164-residue construct C54T/C97A/L99A | SOURCE FACT | Preserve source model, instance, residue and atom identities. No residue is missing from the selected polymer sequence. |
| 3DMX construct has no cysteine and no disulfide | SOURCE FACT | No disulfide assignment. |
| Source OXT occurs on Leu164 | SOURCE FACT | Treat Leu164 as the polymer C terminus; terminal state is still a ChemicalState decision. |
| Crystallization context includes pH 6.9, 277 K, 2.0–2.2 M K/Na phosphate, 5 mM BME and 5 mM oxidized BME | SOURCE FACT | Reported source condition only. |
| Soak/binding pH for the deposited 3DMX complex | SOURCE FACT LIMITATION | Not reported or linked to a preparation route in the reviewed evidence. |
| Conventional Asp/Glu −1, Arg/Lys +1, Tyr neutral at the chosen proxy | SCIENTIFIC INFERENCE | Candidate microstate rule; not an experimental observation or predicted pKa result. |
| HIS31 neutral HID | SCIENTIFIC INFERENCE | ND1–Asp70 OD2 is 2.672 Å and geometry supports delta-N tautomer; neutral-versus-positive state remains unresolved experimentally. |
| Standard charge states for each numbered ionizable residue and charged termini | OWNER APPROVED — YES | Exact list below, with GLU128− and the corrected 51-side-chain-plus-two-termini inventory, is authorized only for this fixture profile; see OWNER_AUTHORIZATION_RECORD.md. |
| Parent-mapped receptor hydrogen identities and coordinates | TOOL-DERIVED | Not generated. Future RDKit-only H addition must be downstream of an approved ChemicalState. |
| BNZ component ID and neutral six-carbon aromatic graph | SOURCE FACT | CCD BNZ; not BEN; no protomer, tautomer, or stereochemical ambiguity. |
| Six BNZ heavy-atom coordinates | SOURCE FACT | Read from deposited 3DMX model 1 and retained exactly. |
| BNZ H1–H6 coordinates | TOOL-DERIVED | Not generated; future RDKit AddHs call must use source coordinates and explicit CCD graph, with no conformer generation or minimization. |
| Use of the declared state for this single profile | OWNER APPROVED — YES | Approval does not claim that the source experimentally established the state; see OWNER_AUTHORIZATION_RECORD.md. |

## Exact receptor state hypothesis

At the proposed target_pH 6.9 crystallization-context proxy:

- ASP 10, 20, 47, 61, 70, 72, 89, 92, 127, 159 are deprotonated, formal charge −1.
- GLU 5, 11, 22, 45, 62, 64, 108 are deprotonated, formal charge −1.
- GLU128 is deprotonated, formal charge −1, under the broad DEC04 rule that Asp/Glu side chains are deprotonated. It was omitted from the numbered DEC04 state list; AUTH04-02 resolves that historical omission by explicit owner approval.
- ARG 8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154 are protonated, formal charge +1.
- LYS 16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162 are protonated, formal charge +1.
- TYR 18, 24, 25, 88, 139, 161 are neutral.
- HIS31 is neutral HID. It is the only histidine in the entity.
- Met1 N terminus is protonated, formal charge +1.
- Leu164 C terminus is deprotonated, formal charge −1, with source OXT.
- No caps; no disulfides; no automatic pKa or protonation inference.

DEC04 says there are 49 ionizable side-chain groups plus two termini. A read-only grouping of its IONIZABLE_RESIDUE_PROXIMITY.csv gives 51 distinct side-chain residue identities plus two termini; GLU128 is present in the CSV and absent from the numbered state list. Excluding GLU128, the numbered proposal contains 50 side-chain identities if HIS31 is counted. The count/list discrepancy is preserved as predecessor history and is resolved for this single profile by the owner decision: 51 side-chain identities plus two termini, including GLU128−. The state remains a declared preparation hypothesis, not an experimentally observed or validated biological microstate. Local contact distances show the nearest side-chain ionizable group is Tyr88 OH at 8.1425 Å; HIS31 is 19.1250 Å from BNZ. Those distances bound direct reference-pose pair cutoff relevance only and do not remove sites from the full ChemicalState.

## Exact ligand state

Use neutral CCD BNZ, rigid aromatic C1–C6 ring, six experimental carbon coordinates preserved. Add exactly one hydrogen H1–H6 per parent carbon using the CCD graph and observed conformer. No BEN substitution, protonation/tautomer enumeration, stereochemical choice, source heavy atom change, CCD example-H coordinate reuse, or minimization.

## Owner decision closure

AUTH04-02 is OWNER APPROVED — YES. The exact state hypothesis, target_pH context interpretation, GLU128− assignment, corrected 51-side-chain-plus-two-termini count, BNZ state, and scope limitations are recorded in `OWNER_AUTHORIZATION_RECORD.md`. No automatic state generation or broader profile is authorized.

## Owner status

OWNER APPROVED — YES on 2026-10-04; see `OWNER_AUTHORIZATION_RECORD.md`.
