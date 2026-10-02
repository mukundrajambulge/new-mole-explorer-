# Construct sequence reconciliation

## Deposited sequence

The current 4W52 polymer entity sequence has 172 residues. Its first 164 positions align position-for-position to UniProt P00720, with three differences: Arg12→Gly, Leu99→Ala and Ile137→Arg. The final eight positions are LEHHHHHH. The current wwPDB validation report labels positions 12 and 137 “variant,” position 99 “engineered mutation,” and positions 165–172 “expression tag.” These labels describe the deposited/reference comparison; they do not prove the experimenter's intent for R12G/I137R or the tag's physical state after purification.

The exact deposited sequence is therefore identifiable. The exact physical construct used in the crystallization experiment is not fully resolved because the accessible 2015 primary article delegates construct and purification details to the corrected SI, which could not be retrieved. No author confirmation or exact 4W52 plasmid map is present in the retained evidence.

## Position map

SEQUENCE_POSITION_MAP.csv is the authoritative 172-row mapping. It records the deposited residue, P00720 residue, coordinate presence, sequence-difference/tag annotation and terminal relevance at every position. Summary rows:

| Position | Deposited | P00720 | Coordinates | Deposit/validation status | Physical interpretation |
|---:|---|---|---|---|---|
| 12 | Gly | Arg | Present | Variant | Gly is the deposited coordinate identity; intended versus background origin is unresolved |
| 99 | Ala | Leu | Present | Engineered mutation | L99A is the intended cavity mutation named by the primary study and validation report |
| 137 | Arg | Ile | Present | Variant | Arg is the deposited coordinate identity; intended versus background origin is unresolved |
| 164 | Leu | Leu | Present | Last modeled coordinate residue | It is not established as the physical terminus if the tag was retained |
| 165–172 | LEHHHHHH | No P00720 counterpart | Absent | Expression tag in deposited entity; unmodeled | Presence in purified/crystallized material and cleavage state unresolved |

## Exact sequence status and terminology

For a coordinate-level identity statement, use “4W52 deposited T4 lysozyme polymer sequence with G12/A99/R137 and deposited C-terminal LEHHHHHH extension; coordinates modeled through L164.” Do not shorten this to “T4 lysozyme L99A” when describing the deposited sequence. “Exact crystallized construct” remains provisional until primary construct/purification evidence or author clarification distinguishes R12G/I137R origin and resolves tag cleavage/retention.

Source classes: deposited sequence and coordinate identities are WWPDB_DEPOSITION; variant/mutation/tag labels are WWPDB_VALIDATION; reference residues are UNIPROT; the unresolved physical interpretation is PROJECT_INFERENCE, not a source fact.
