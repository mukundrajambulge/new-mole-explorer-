# D3-PREP-DEC-02 candidate decision matrix

| Review item | Evidence and assessment | Disposition | Consequence |
|---|---|---|---|
| Exact 3ATL source | Retained official mmCIF hash recomputed; fresh official download is byte-identical | VERIFIED | Source identity is not the reason for rejection |
| Protein construct | Cationic bovine trypsin, entity 1 / chain A, sequence matches UniProt P00760:24–246; all 223 positions modeled | VERIFIED AS DEPOSITED | Does not itself authorize receptor chemical-state preparation |
| Termini / missingness | Mature Ile and terminal Asn are observed; no missing standard protein heavy atoms, gaps, or altlocs | SOURCE COMPLETE | Terminal protonation and hydrogens remain unresolved |
| Disulfides | Six deposited connections and distances documented; includes a pocket-proximal Cys191–Cys215 pair | SOURCE VERIFIED | Must retain disulfide chemistry in any future state |
| Biological assembly | Entry defines assembly 1 as monomeric | SOURCE DEFINITION ACCEPTED FOR THIS REVIEW | No alternative assembly selected |
| BEN identity and map | CCD BEN benzamidine; one 9/9 heavy-atom instance; C1–C6, C, N1, N2; no source H coordinates | VERIFIED | Benzene/BNZ interpretation explicitly rejected |
| BEN protonation | +1 amidinium strongly favored in bulk at pH 8.5 from compiled pKa near 11.6; no bound Hs and no atomwise resonance convention approved | AMBIGUOUS / NOT FROZEN | No ligand ChemicalState digest or XS assignment |
| BEN type/torsions | Vina classic has no partial-charge term but ChemicalState-dependent donor/acceptor typing is mandatory; exact atom typing and N_tors/KinematicModel are not frozen | INCOMPLETE | Cannot seal PreparedLigandState |
| Binding-site waters | Eight within 5 Å, sixteen within 8 Å; water study reports bound-state W1 bridge to Tyr228/Ser190 and Asp189 reservoir | SCIENTIFICALLY SITE-RELEVANT | Cannot justify dry omission for this bound-state fixture |
| Approved water capability | CORE_DRY_V1 has no scoring water; no approved FixedWaterProfile or compatible scorer | UNSUPPORTED FOR THIS CANDIDATE | Decisive rejection; no water deletion or invented profile |
| Calcium | One Ca2+, coordinated at a distal site, nearest BEN heavy atom 22.261 Å | ROLE EVIDENCE; SITE-INFLUENCE REVIEW STILL REQUIRED | Not the decisive blocker; no generic removal |
| DMSO | Three DMS instances; nearest BEN heavy atom 12.365 Å | ROLE/PROVENANCE REQUIRED | No blanket removal |
| Receptor microstates / H policy | Local Asp189/Asp194/Asp102, His58 and Tyr states plus N terminus require explicit reviewed choices; no H positions exist | INCOMPLETE | No receptor ChemicalState or preparation profile |
| Toolchain | No production preparer/profile approved; Meeko 0.8.0 experimental/reference only; exact binary/environment/settings hashes absent | NOT REPRODUCIBLE / NOT APPROVED | No execution handoff |
| Owner direction | Current D3-RA-01 owner package calls 3ATL a later water/component stress fixture; current user gate requests review, not preparation approval | NO 3ATL PREPARATION APPROVAL | Owner approval remains pending |
| Independent structural review | No named reviewer or dated review evidence available | NOT OBTAINED | Required before any later scientific authorization |
| Independent comp-chem review | No named reviewer or dated review evidence available | NOT OBTAINED | Required before any later scientific authorization |
| Current prepared pair | No D2-sealed state objects exist | NOT PREPARED | No D3 fixture manifest or validation |
| Final candidate outcome | Essential water cannot be represented under an approved profile | REJECTED FOR ORDINARY CORE_DRY_V1 FIXTURE | Return to fixture search; D3_PREP_EXEC_02_PROMPT.md not generated |

## Decision rule applied

The generated prompt requires rejection and return to fixture selection if essential binding-site water cannot be encoded by an already approved profile. PHD-V2-08 explicitly blocks CORE_DRY_V1 where the binding model depends on recognition water and requires a distinct validated profile for fixed water. No current canonical source approves such a profile. Other open decisions are recorded rather than defaulted.
