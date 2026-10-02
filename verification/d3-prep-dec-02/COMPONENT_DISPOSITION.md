# 3ATL non-polymer component disposition

## Inventory

The frozen source contains one BEN ligand instance, one calcium ion, three DMS instances, and 317 deposited water atoms. There are no other non-polymer chemical components in the source audit.

| Component | Deposited instance | Minimum distance to any BEN heavy atom | Local structural evidence | Disposition |
|---|---|---:|---|---|
| Ca2+ | label asym B, author chain A, residue 1; one atom | 22.261 Å | Nearest protein atoms include Val75 O at 2.289 Å, Glu70 OE1 at 2.296 Å, Glu80 OE2 at 2.409 Å, and Asn72 O at 2.428 Å | Resolved distal coordination site; do not delete generically. Candidate's pocket-level influence still requires a SiteInfluenceRequirement-based decision and reviewer approval. |
| DMSO | label asym C, author chain A, residue 2 | 22.227 Å | Deposited dimethyl sulfoxide; four atoms | Distal to BEN. Role-specific exclusion may be considered only with evidence, provenance and approved component policy. |
| DMSO | label asym D, author chain A, residue 3 | 12.365 Å | Deposited dimethyl sulfoxide; four atoms | Closest DMSO instance to BEN, still outside direct contact; no automatic removal rule. |
| DMSO | label asym E, author chain A, residue 4 | 18.033 Å | Deposited dimethyl sulfoxide; four atoms | Distal to BEN; no automatic removal rule. |
| Water | label asym G, 317 atoms/residues | 2.747 Å nearest | Eight water residues within 5 Å and 16 within 8 Å; full list in WATER_NETWORK_AUDIT.md | Essential-water risk is decisive. The source water network cannot be represented under the currently approved CORE_DRY_V1 profile. Reject 3ATL/BEN for this fixture. |

The official entry identifies the deposited components as calcium ion, dimethyl sulfoxide and benzamidine: [RCSB 3ATL](https://www.rcsb.org/structure/3ATL) and [NCBI Structure 3ATL](https://www.ncbi.nlm.nih.gov/Structure/pdb/3ATL). The retained audit counts and water distances are in verification/d3-prep-cand-02/CANDIDATE_RAW_AUDIT.json.

## Calcium

The deposited calcium is coordinated at a distinct site by several protein oxygen atoms at approximately 2.3–2.4 Å. UniProt annotates one Ca2+ ion per subunit, and an earlier crystallographic refinement separately treats the calcium-binding site. This supports calling it a structured ion rather than an arbitrary HETATM contaminant. The BEN site is spatially separate in the deposited coordinates, but no arbitrary distance cutoff can substitute for the scorer-derived SiteInfluenceRequirement.

Ordinary V1 has no coordination-aware metal potential. If a future task shows that calcium coordination influences the admissible ligand poses or receptor state, ordinary V1 cannot claim to represent it. An omission would require explicit biological-role and site-influence evidence plus provenance. No calcium-retention or deletion profile is approved here.

## DMSO

The component code DMS denotes dimethyl sulfoxide. All three observed DMSO molecules are distant from BEN by the measurements above. Their exact crystallization/soaking role is not resolved from coordinate proximity alone. Preserve their source evidence. Any later exclusion must identify each instance and record its reason; blanket solvent deletion is prohibited.

## Result

Calcium and DMSO do not rescue or independently determine the candidate decision. The ligand-recognition water network is the decisive unsupported component. The correct record for every component is source-preserving; no molecular component set was constructed or modified.

## Normative references

- [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit)
- [PHD-V2-08](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit)
- [UniProt P00760 calcium/cofactor annotation](https://rest.uniprot.org/uniprotkb/P00760.txt)
- [Bode & Schwager, 1975 calcium-binding and benzamidine-binding structure](https://pubmed.ncbi.nlm.nih.gov/512/)
