# Modeled versus deposited residues

The deposited polymer entity is 172 residues, while model 1 contains coordinates for a continuous 164-residue protein chain, positions 1–164. The eight-position difference is exactly the C-terminal LEHHHHHH expression-tag annotation, positions 165–172, absent from coordinates. This is an entity-sequence/coordinate-coverage difference; it does not establish that the tag was absent from the physical crystallization sample.

| Sequence range / position | Deposited residue | UniProt reference | Modeled residue | Coordinates | Status | Terminal relevance |
|---|---|---|---|---|---|---|
| 1–11 | Same as P00720 | Same | Same deposited residues | Present | Reference match | Internal |
| 12 | Gly | Arg | Gly | Present | Validation calls variant | Internal; origin unresolved |
| 13–98 | Same as P00720 | Same | Same deposited residues | Present | Reference match | Internal |
| 99 | Ala | Leu | Ala | Present | Validation calls engineered mutation | Internal L99A cavity mutation |
| 100–136 | Same as P00720 | Same | Same deposited residues | Present | Reference match | Internal |
| 137 | Arg | Ile | Arg | Present | Validation calls variant | Internal; origin unresolved |
| 138–163 | Same as P00720 | Same | Same deposited residues | Present | Reference match | Internal |
| 164 | Leu | Leu | Leu | Present | Last modeled coordinate residue | Physical terminal status unresolved |
| 165 | Leu | None | None | Absent | Expression tag | First deposited extension residue; physical state unresolved |
| 166 | Glu | None | None | Absent | Expression tag | Unmodeled extension |
| 167–172 | His x6 | None | None | Absent | Expression tag | Deposited tag end; physical state unresolved |

The full position-by-position table is SEQUENCE_POSITION_MAP.csv. The deposited entity has no other unmodeled polymer positions. Separately, 18 heavy atoms are annotated missing in otherwise modeled residues K16, K60, R80, R125, K147, K162 and N163. For each of these residues the nearest observed atom in that residue is more than 8 Å from BNZ; the missing atoms do not create a local BNZ-shell defect. No coordinates were repaired.
