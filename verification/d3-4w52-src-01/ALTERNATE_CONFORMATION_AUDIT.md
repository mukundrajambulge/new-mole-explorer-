# Alternate-conformation audit

The frozen mmCIF has 13 protein residues with alternate-location atoms. The distances below are minimum distances from atoms belonging to each alternate branch alone to the six deposited BNZ carbon atoms. “Within 5/8 Å” uses those branch-only distances. The atom list is the alternate-labeled atom set; common atoms are not duplicated into each branch. No protein alternate branch has a direct heavy-atom contact at or below 4.5 Å. M106 is the only alternate side chain whose branch-specific atoms enter the 8 Å scoring shell. This changes potential direct-score geometry, not atom element/type identity.

| Residue | Alternate-labeled atoms | Alt A occupancy; min to BNZ | Alt B occupancy; min to BNZ | Branch within 5 Å | Branch within 8 Å | Disposition |
|---|---|---:|---:|---|---|---|
| Met1 | CA, CB, CE, CG, SD | 0.50; 16.559 Å | 0.50; 16.968 Å | No | No | Tie; remote |
| Arg14 | CA, CB, CD, CG, CZ, NE, NH1, NH2 | 0.50; 25.545 Å | 0.50; 22.029 Å | No | No | Tie; remote |
| Thr21 | CA, CB, CG2, OG1 | 0.80; 18.067 Å | 0.20; 17.918 Å | No | No | Unique occupancy maximum A; remote |
| Asn53 | CA, CB, CG, ND2, OD1 | 0.60; 35.010 Å | 0.40; 35.011 Å | No | No | Unique maximum A; remote |
| Val57 | CA, CB, CG1, CG2 | 0.60; 31.588 Å | 0.40; 31.530 Å | No | No | Unique maximum A; remote |
| Asp61 | CA, CB, CG, OD1, OD2 | 0.60; 27.847 Å | 0.40; 27.829 Å | No | No | Unique maximum A; remote |
| Asn68 | CA, CB, CG, ND2, OD1 | 0.70; 18.184 Å | 0.30; 18.127 Å | No | No | Unique maximum A; remote |
| Met106 | CA, CB, CE, CG, SD | 0.60; 7.986 Å | 0.40; 7.720 Å | No | Yes, both branches | Near scoring shell; unique maximum A is available under a named coherent max-occupancy profile, but the branch geometry must be explicit |
| Thr109 | CA, CB, CG2, OG1 | 0.60; 9.851 Å | 0.30; 9.808 Å | No | No | In the paper's F-helix range; branch atoms outside 8 Å; unique maximum A |
| Arg119 | CA, CB, CD, CG, CZ, NE, NH1, NH2 | 0.50; 8.849 Å | 0.50; 8.849 Å | No | No | Tie; shared atoms bring the residue backbone within 8 Å, but alternate-specific atoms are outside 8 Å |
| Met120 | CA, CB, CE, CG, SD | 0.80; 9.566 Å | 0.20; 9.552 Å | No | No | Unique maximum A; outside 8 Å |
| Arg125 | CA, CB, CD, CG, NE | 0.50; 12.563 Å | 0.50; 12.551 Å | No | No | Tie; remote |
| Arg154 | CA, CB, CD, CG, CZ, NE, NH1, NH2 | 0.60; 11.801 Å | 0.40; 11.793 Å | No | No | Unique maximum A; outside 8 Å |

For Arg119, each conformer including common atoms has a 7.821 Å minimum because the nearest atom is shared, while the alternate-labeled branch atoms themselves are 8.849 Å away. The sidechain alternate therefore does not add a branch-specific atom to the 8 Å region. M106 branch-specific minima are 7.986 and 7.720 Å; neither branch makes a ≤4.5 Å direct contact, but the two positions can contribute different pair distances inside an 8 Å direct-score cutoff. Atom identity and XS chemical typing are unchanged by the coordinate branch.

## Interpretation and selection policy

The primary article says that alternative conformations were modeled when supported by Fo-Fc density and Rfree improvement, using a 10% occupancy threshold; it identifies F-helix residues 107–115 as omitted from the molecular-replacement starting model and later built. Its Fig. 2 caption classifies the benzene complex as the closed cavity conformation and says ligand poses were assigned to protein conformations by matching occupancy with the F-helix conformation. In the deposited 4W52 file the F-helix backbone has one coordinate conformation, with atoms at residues 108–114 carrying occupancy 0.90 and no alternate-location IDs. BNZ carries occupancy 0.70. Thr109 has alternate sidechain atoms at 0.60/0.30; BNZ itself has no alternate location. The deposited coordinate state is explicit, but the paper's stated occupancy matching does not reconcile the 0.70 ligand with the 0.90 F-helix backbone. The accessible main text does not establish whether an additional 4W52 F-helix state was seen in density but left unmodeled. The corrected SI, which could carry the per-entry interpretation, was inaccessible.

At least four protein residues have 0.50/0.50 ties (Met1, Arg14, Arg119 and Arg125). PHD-V2-03 requires an explicit coordinate-state decision for occupancy ties. A unique maximum-occupancy profile could choose A for the other residues, including M106, but no production conformer was selected or generated in this source-only gate. Any later review must name all selected branches, handle ties explicitly and freeze one coordinate state. It must not imply the 4W52 ligand is disordered: BNZ is a single deposited conformer at occupancy 0.70. The unresolved 0.70/0.90 ligand/backbone occupancy relationship should be included in any primary-source clarification.

Water alternate-location records were audited separately: 18 water sites carry alternate-location labels and none of those states is within 8 Å of BNZ. See source_artifacts/derived/4W52_water_altloc_audit.json.
