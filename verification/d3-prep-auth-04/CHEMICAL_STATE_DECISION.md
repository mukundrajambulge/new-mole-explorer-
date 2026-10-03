# 3DMX/BNZ chemical-state decision proposal

Status: proposed, not owner-approved and not prepared.

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
| Standard charge states for each numbered ionizable residue and charged termini | OWNER DECISION REQUIRED | Exact list below requires explicit owner approval for this fixture profile; GLU128 and the predecessor's count conflict require explicit reconciliation. |
| Parent-mapped receptor hydrogen identities and coordinates | TOOL-DERIVED | Not generated. Future RDKit-only H addition must be downstream of an approved ChemicalState. |
| BNZ component ID and neutral six-carbon aromatic graph | SOURCE FACT | CCD BNZ; not BEN; no protomer, tautomer, or stereochemical ambiguity. |
| Six BNZ heavy-atom coordinates | SOURCE FACT | Read from deposited 3DMX model 1 and retained exactly. |
| BNZ H1–H6 coordinates | TOOL-DERIVED | Not generated; future RDKit AddHs call must use source coordinates and explicit CCD graph, with no conformer generation or minimization. |
| Use of the declared state for this single profile | OWNER DECISION REQUIRED | Approval does not claim that the source experimentally established the state. |

## Exact receptor state hypothesis

At the proposed target_pH 6.9 crystallization-context proxy:

- ASP 10, 20, 47, 61, 70, 72, 89, 92, 127, 159 are deprotonated, formal charge −1.
- GLU 5, 11, 22, 45, 62, 64, 108 are deprotonated, formal charge −1.
- GLU128 is a proposed extension to deprotonated, formal charge −1 because the broad DEC04 rule says all Asp/Glu side chains are deprotonated and the source audit includes GLU128. It was omitted from the numbered DEC04 state list and remains OWNER DECISION REQUIRED; it is not treated as settled.
- ARG 8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154 are protonated, formal charge +1.
- LYS 16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162 are protonated, formal charge +1.
- TYR 18, 24, 25, 88, 139, 161 are neutral.
- HIS31 is neutral HID. It is the only histidine in the entity.
- Met1 N terminus is protonated, formal charge +1.
- Leu164 C terminus is deprotonated, formal charge −1, with source OXT.
- No caps; no disulfides; no automatic pKa or protonation inference.

DEC04 says there are 49 ionizable side-chain groups plus two termini. A read-only grouping of its IONIZABLE_RESIDUE_PROXIMITY.csv gives 51 distinct side-chain residue identities plus two termini; GLU128 is present in the CSV and absent from the numbered state list. Excluding GLU128, the numbered proposal contains 50 side-chain identities if HIS31 is counted. This count/list discrepancy is unresolved and blocks execution until the owner confirms the complete residue set and GLU128 assignment. The proposed map is not a validated microstate. Local contact distances show the nearest side-chain ionizable group is Tyr88 OH at 8.1425 Å; HIS31 is 19.1250 Å from BNZ. Those distances bound direct reference-pose pair cutoff relevance only and do not remove sites from the full ChemicalState.

## Exact ligand state

Use neutral CCD BNZ, rigid aromatic C1–C6 ring, six experimental carbon coordinates preserved. Add exactly one hydrogen H1–H6 per parent carbon using the CCD graph and observed conformer. No BEN substitution, protonation/tautomer enumeration, stereochemical choice, source heavy atom change, CCD example-H coordinate reuse, or minimization.

## Owner question

Approve or replace this complete receptor chemical-state hypothesis, including confirmation whether GLU128 is deprotonated and whether the source audit's 51 unique side-chain identities are the complete set, the BNZ explicit state, and the context/interpretation in PREPARATION_CONTEXT_DECISION.md. YES accepts one explicit development state only under the named profile and resolves the listed omission; it does not establish experimental pH, unique biology-wide microstate, or general automatic state generation. NO leaves preparation unauthorized.

## Owner status

NOT RECORDED.
