# Water network matrix

Counts are deposited HOH residues whose nearest heavy-atom distance to any deposited ligand heavy atom is at most 5 Å or 8 Å, respectively. They are geometric screening values, not proof that a water is essential. The “evidence interpretation” column distinguishes observed proximity from source-supported functional interpretation. No water was deleted or converted into a scoring atom.

| Entry / ligand | Waters ≤5 Å / ≤8 Å | Nearest water | Other water observations | Evidence interpretation for CORE_DRY_V1 | Disposition |
|---|---:|---:|---|---|---|
| 4W52 / BNZ | 0 / 1 | 7.841 Å | The closest deposited water is outside 5 Å; no near-ligand water bridge is present in the audited model. | No essential-water evidence was identified in the reviewed source set. This favorable geometry does not resolve the construct blocker. | Promising, source resolution required. |
| 5JWT / BNZ | 1 / 2 | 3.736 Å | One water lies within 5 Å. | A single nearby water is not proof of essentiality; no water-role source audit was completed sufficient to approve omission. Local receptor disorder and missing residues already block selection. | Structurally incomplete. |
| 9BZT / BNZ | 0 / 0 | 9.042 Å | No water in the 8 Å ligand shell. | Dry geometry is favorable, but the short nonstandard peptide receptor and co-ligand state are unsupported. | Current scorer unsupported. |
| 4EMN / BEN | 7 / 21 | 2.827 Å | Multiple near-ligand waters; sulfate is 3.029 Å from BEN. | Counts alone do not show an essential network. Water roles and sulfate context are unresolved; no omission policy can be justified from this screen. | Chemical-state ambiguous. |
| 2OXS / BEN | 9 / 19 | 2.823 Å | Multiple near-ligand waters; sulfate is 3.413 Å from BEN. | Counts alone do not show essentiality. A primary-source site/water-role review and component disposition would be required. | Promising, source resolution required. |
| 7BNH / BEZ | 10 / 32 | 2.606 Å | Many near-ligand waters; MES is 3.50 Å from BEZ. | Dense local hydration and buffer raise a site-state question, but the count is not treated as essential-water proof. | Chemical-state ambiguous. |
| 6TGU / N92 | 8 / 20 | 2.343 Å | Waters coexist with split ligand occupancy and three nearby receptor alternate residues. | A single dry receptor/ligand state and any water omission rule are unresolved. | Structurally incomplete. |
| 1MUP / TZL | 2 / 2 | 2.142 Å | Both waters are within 5 Å. Timm et al. report two interior waters in MUP-I and water-mediated polar-group interaction possibilities; the source article is https://doi.org/10.1110/ps.52201. | This is direct source-level evidence that the cavity water environment can participate in pheromone recognition. It is not a defensible dry fixture without a candidate-specific water-state argument. | WATER_DEPENDENT |
| 7FEZ / 4I1 | 9 / 26 | 2.679 Å | Numerous near-ligand waters around an unsaturated fatty-acid ligand. | The counts do not prove essentiality; the acid-state and local alternate conformations remain unresolved, and omission has no approved derivation here. | Chemical-state ambiguous. |
| 3BCJ / FIS | 27 / 48 | 1.346 Å | Extremely dense solvent shell; citrate is 3.13 Å from ligand. A 1.346 Å water–ligand heavy-atom separation is anomalously short and needs validation as a coordinate/occupancy overlap, not an interaction assignment. | A dry omission policy cannot be justified from the current screen. The anomalous contact, partial ligand occupancy and citrate make this unsuitable without a separate source and validation review. No essential-water conclusion is inferred from count alone. | Not suitable. |

## Deposited-water identity and contact geometry

The audit JSON now retains each water in the ligand 8 Å shell with label asym/auth residue ID, occupancy, B factor, nearest ligand heavy atom and distance, nearest receptor heavy atoms within 4 Å, and receptor N/O/S atoms within 3.6 Å. A geometry-only potential bridge is counted when the water is within 3.5 Å of a ligand heavy atom and within 3.6 Å of any receptor N/O/S atom. The flag does not inspect hydrogen orientation, formal donor/acceptor state, symmetry mates, altloc compatibility or primary-source function; it is a screening description only, not a hydrogen-bond or essential-water assignment.

| Entry | Nearest deposited water (occupancy; B; nearest ligand atom/distance) | Waters ≤3.5 Å from ligand / geometry-only bridge candidates | Closest relevant receptor polar geometry |
|---|---|---:|---|
| 4W52 / BNZ | D:400 (1.00; 27.60; C5 / 7.841 Å) | 0 / 0 | D:400 is outside the ligand shell; nearest receptor atom is LYS83.O at 2.62 Å from the water. |
| 5JWT / BNZ | C:314 (1.00; 25.66; C5 / 3.736 Å) | 0 / 0 | Nearest receptor atom to C:314 is GLN102.OE1 at 2.54 Å. |
| 9BZT / BNZ | G:201 (1.00; 9.33; 9.042 Å from ligand) | 0 / 0 | No water lies within the 8 Å ligand shell. |
| 4EMN / BEN | M:504 (1.00; 11.98; N1 / 2.827 Å) | 2 / 2 | M:504 has GLU292.OE1 at 3.06 Å; M:576 also meets the coarse geometry screen. |
| 2OXS / BEN | E:995 (1.00; 35.73; N1 / 2.823 Å) | 4 / 4 | E:995 has LYS224.O at 2.66 Å; E:811, E:972 and E:907 also meet the coarse geometry screen. |
| 7BNH / BEZ | M:610 (1.00; 12.81; O2 / 2.606 Å) | 5 / 4 | M:610 has LYS425.NZ at 3.03 Å; M:644, M:646 and M:696 also have candidate polar proximity. |
| 6TGU / N92 | J:502 (1.00; 10.30; N08 / 2.343 Å) | 5 / 5 | J:502 has GLU115.O at 3.08 Å; J:512, J:550 and J:757 also meet the coarse geometry screen. |
| 1MUP / TZL | G:349 (1.00; 46.99; C9 / 2.142 Å) | 2 / 2 | G:349 has PHE42.O at 3.22 Å. G:377 is 2.769 Å from TZL C9 but only 1.727 Å from TYR124.OH, an anomalously short water/protein heavy-atom distance that needs validation. The primary MUP-I paper independently describes an interior two-water environment, so this candidate remains water-dependent. |
| 7FEZ / 4I1 | E:324 (1.00; 6.41; O1 / 2.679 Å) | 3 / 3 | E:324 has THR40.OG1 at 2.73 Å; E:364 and E:365 also meet the coarse geometry screen. |
| 3BCJ / FIS | E:1548 (0.42; 14.75; C14 / 1.346 Å) | 19 / 7 | E:1548 has no receptor heavy atom within 4 Å. E:1548, E:1549 and E:1547 overlap ligand heavy atoms at 1.35, 1.51 and 1.70 Å while each has occupancy 0.42 versus FIS occupancy 0.58; validate as a possible mutually exclusive coordinate state, not a water interaction. E:1450 is another direct contact, 2.14 Å from ligand O20 and 3.03 Å from TRP20.NE1. |

The closest water records and geometric candidate contacts are reproducible in each candidate audit JSON under water_network_geometry_only_within_8A. The contact counts do not classify individual waters as essential or dispensable. Under CORE_DRY_V1, any future dispensable-water omission requires a named role, reason, provenance and evidence; blanket water deletion is not authorized.
