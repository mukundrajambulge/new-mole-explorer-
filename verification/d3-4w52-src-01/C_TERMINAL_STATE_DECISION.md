# C-terminal state decision

## Question

Does coordinate residue 164 (Leu) represent the physical C terminus of the crystallized protein, or does a disordered/unmodeled tag continue after it?

## Evidence

The deposited entity continues after residue 164 with LEHHHHHH at positions 165–172. The current validation report annotates those positions as expression tag and as unmodeled. The polymer coordinate model stops at Leu164. The primary article sends cloning and purification details to its SI; the correction notice says that SI was corrected online, but the corrected SI file could not be retrieved. No evidence establishes physical cleavage, retained tag, or the cleavage boundary.

## Decision

**Physical C-terminal chemistry is unresolved.** Neither “Leu164 is the physical terminus” nor “the tag was physically retained” is supported. No terminal atoms, charges, caps or tag residues may be inferred from this source gate. The coordinate end at residue 164 is not treated as a proven molecular terminus.

The current PHD-V2-03 contract distinguishes receptor identity, experimental structure state, coordinate state and chemical state; it also requires termini to follow polymer connectivity and source evidence, and prohibits automatic tag trimming or wild-type restoration. This is the right semantic model for a future explicitly unresolved extension. It does not by itself prove that a concrete preparation toolchain can parameterize a chain whose residues 165–172 have no coordinates while preventing residue 164 from being treated as a physical terminus. That representability question belongs in a later authorization gate after the physical state is clarified.

## Case handling

| If authoritative evidence establishes… | Correct interpretation | Consequence for residue 164 |
|---|---|---|
| Tag cleaved before crystallization | Determine cleavage site and exact final sample sequence; no cleavage boundary is assumed here | Leu164 may be the physical terminus only if the documented cleavage leaves it terminal |
| Tag retained but disordered | Full construct includes LEHHHHHH, while coordinate state has an unresolved continuation | Leu164 is an observed coordinate endpoint, not a physical C terminus; do not add terminal chemistry there or rebuild the tag |
| Evidence still cannot distinguish these cases | Construct/chemical state remains unresolved | No preparation authorization |

Current result: the third case. Retire 4W52 from the current CORE_DRY_V1 fixture path pending new primary evidence or author clarification.
