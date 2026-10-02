# D3-PREP-DEC-02 — 3ATL/BEN preparation authorization review

## Final classification

**D3-PREP-DEC-02 HOLD — 3ATL/BEN REJECTED FOR THE AVAILABLE CORE_DRY_V1 FIXTURE**

**Candidate outcome:** reject 3ATL/BEN for the intended ordinary V1 development-only prepared-state fixture.
**Preparation authorization:** not granted.
**D3_PREP_EXEC_02_PROMPT.md:** not generated.
**Human reviews and owner approval:** not obtained; all remain pending.
**Project gates:** full D3 remains HOLD; D4 remains BLOCKED; DOCKING.RUN remains unavailable.

## Decision basis

The exact deposited 3ATL source and BEN instance are verified. The protein is an intact, single modeled mature bovine cationic trypsin chain with no sequence discrepancy, missing protein heavy atom, chain break, or receptor alternate conformation. BEN is benzamidine, not benzene; it is one complete 9-heavy-atom instance with a deposited neutral CCD depiction and no experimentally placed ligand hydrogens.

Those favorable source properties do not make the candidate admissible under the controlling receptor/scorer profile. CORE_DRY_V1 has no explicit scoring water. Current PHD-V2-08 says a dry V1 model is unsupported when its claimed pocket depends on a conserved structural or ligand-recognition bridging water, and requires a separate validated water profile for fixed-water scoring. The primary trypsin–benzamidine water study identifies its state B with the crystallographic complex, including 3ATL, and reports the long-lived W1 bridge connecting benzamidine with Tyr228 and Ser190 plus a multi-water reservoir below Asp189. The retained source independently has eight deposited water residues within 5 Å of BEN and 16 within 8 Å; several oxygen positions lie about 2.75–3.65 Å from BEN heavy atoms. This is direct evidence that water is part of the molecular environment being considered, not enough evidence to call the binding-site network dispensable. The current project has no approved fixed-water profile that could encode it. Removing the waters to fit the dry profile would make an unsupported scientific choice.

This outcome follows the generated authorization prompt's fail-closed instruction: if an essential binding-site water cannot be represented by an already approved profile, reject the candidate and return to fixture selection. No special profile is proposed or silently introduced.

BEN's likely bulk-solution state is amidinium +1: the recorded crystallization pH is 8.5 and the compiled aqueous conjugate-acid pKa is about 11.6. Henderson–Hasselbalch gives approximately 99.92% protonated in bulk solution. This is an inference, not a bound-state measurement. It does not settle the explicit atom-mapped resonance/bond-order representation or receptor microstates required by the current ChemicalState and XS-typing contracts. The neutral CCD record is not accepted as a bound-state assignment, and no charge/protomer/tautomer state is sealed.

Calcium is present and has a resolved coordination environment, but its nearest BEN heavy atom is 22.261 Å away. The three deposited DMSO instances are 12.365 Å or more from BEN. These components are not classified for blanket deletion: any future exclusion would require role-specific provenance and a SiteInfluenceRequirement-based irrelevance determination. They are secondary blockers, not the basis for rejecting this candidate; the water-profile mismatch alone is sufficient.

## State and authorization summary

| Question | Decision |
|---|---|
| Exact source artifact | Verified; exact official current 3ATL mmCIF bytes |
| Receptor identity | Complete deposited cationic bovine trypsin chain; sequence aligns to UniProt P00760 residues 24–246 |
| Assembly | Source defines a monomeric biological assembly; preserve this source identity for review |
| BEN identity | CCD BEN benzamidine C7H8N2, not CCD BNZ benzene C6H6 |
| BEN charge | +1 amidinium is favored by bulk-pH/pKa inference; exact bound ChemicalState and atomwise representation not approved |
| Waters | Essential recognition network cannot be represented by the approved dry profile; decisive rejection reason |
| Calcium | One distal coordinated Ca2+; no site-influence exclusion proof or approved metal profile |
| DMS | Three distal DMSO instances; explicit role/provenance needed before omission |
| Receptor chemical state | Not frozen; local titratable states, histidines, termini and hydrogen orientations unresolved |
| Preparation toolchain | None approved or reproducibly locked; Meeko 0.8.0 is reference-only |
| Prepared state / SearchRegion | None exists; raw experimental coordinates are source evidence only |
| Independent reviewers | Structural-biology and computational-chemistry reviews pending |
| Owner | Explicit authorization or rejection of a future alternative fixture not recorded |
| Future execution | Not permitted for 3ATL/BEN; no execution prompt created |

## Project direction

Return to a new fixture-search decision using the current CORE_DRY_V1 boundary as an explicit filter. D3-RA-01 already records 3ATL as a later water/component stress fixture and 181L/BNZ as its earlier primary preference; D3-PREP-DEC-01 subsequently put 181L/BNZ on HOLD for construct and terminal-state ambiguity. Neither record authorizes preparation. The next selection must identify a candidate whose claimed pocket can be defended without unrepresented essential waters or site-influencing unsupported components, then obtain owner direction and independent review before a separate authorization gate.

## Scope and checks

This lane only adds evidence under verification/d3-prep-dec-02/. The candidate source artifact in the predecessor package was read-only. No chemistry, coordinates, atoms, hydrogens, or component set were changed. No receptor/ligand preparation, PDBQT conversion, docking, scoring comparison, acceptance-threshold choice, or D4 work occurred.

The final commit, changed paths, hashes, and worktree cleanliness are recorded in the closing response and SHA256SUMS.txt. D3 remains HOLD; D4 remains BLOCKED; DOCKING.RUN remains unavailable.

The exact candidate-specific authorization contract used for this review is verification/d3-prep-cand-02/D3_PREP_DEC_02_PROMPT.md; it was read in full before analysis.

## Evidence links

- Repository candidate-selection evidence: verification/d3-prep-cand-02/D3_PREP_CAND_02_REPORT.md, CANDIDATE_RAW_AUDIT.json, NONPOLYMER_COMPONENT_MATRIX.md, and OPEN_BLOCKERS.md.
- Prior 181L disposition: verification/d3-prep-dec-01/D3_PREP_DEC_01_REPORT.md and OPEN_BLOCKERS.md.
- Current water/component boundary: [PHD-V2-08](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit) and [Normalized Docking Requirements](https://docs.google.com/document/d/1_M2RzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY/edit).
- Current gate status: [Global Master Plan](https://docs.google.com/document/d/1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk/edit), [Execution Roadmap](https://docs.google.com/document/d/1YDNaYI9xe9lL3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU/edit), and [D3-DEC-02 owner decision](https://docs.google.com/document/d/16tF0edL-qg1QYvYC8m3GcnJVrI_X2SS3VSGxNPRjljA/edit).
- Structure and primary literature: [RCSB 3ATL](https://www.rcsb.org/structure/3ATL), [official 3ATL mmCIF](https://files.rcsb.org/download/3ATL.cif), [Yamane et al. 2011](https://doi.org/10.1107/S0021889811017717), and [Ansari, Rizzi & Parrinello 2022 water study](https://www.nature.com/articles/s41467-022-33104-3).
- Chemical identity and sequence: [CCD BEN](https://www.rcsb.org/ligand/BEN), [CCD BNZ](https://www.rcsb.org/ligand/BNZ), and [UniProt P00760](https://rest.uniprot.org/uniprotkb/P00760.txt).
