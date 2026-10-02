# R12G, I137R and L99A audit

| Difference | Coordinate/deposited residue | UniProt P00720 | wwPDB validation wording | Primary 4W52 paper | Disposition |
|---|---|---|---|---|---|
| Position 12 | Gly | Arg | Variant | Main article describes the system generically as T4 lysozyme/L99A; no R12G statement was found in accessible text | Actual deposited identity is Gly. Intent, background origin and exact plasmid provenance are unresolved |
| Position 99 | Ala | Leu | Engineered mutation | The primary study names T4 lysozyme/L99A and 4W52 as the benzene complex | L99A is the intended cavity mutation; present in deposited coordinates |
| Position 137 | Arg | Ile | Variant | Main article describes the system generically as T4 lysozyme/L99A; no I137R statement was found in accessible text | Actual deposited identity is Arg. Intent, background origin and exact plasmid provenance are unresolved |

The deposited coordinate sequence contains all three substitutions. The entity's deposited mutation annotation singles out L99A, while wwPDB sequence validation detects R12G and I137R as reference variants. The primary article and corrected SI are not equivalent evidence: the SI correction notice is available, but its corrected file was inaccessible in this audit. Therefore the genotype classification for R12G/I137R is not upgraded from “variant” to “engineered” or “background.”

The Addgene record for plasmid 18110 reports insert differences from the referenced T4 lysozyme sequence that include R12G and I137R, but it does not identify that plasmid as the construct used for 4W52. Later literature describes related T4 lysozyme mutant combinations in other vector contexts; that is corroboration that the substitutions occur in research constructs, not proof of the 4W52 clone or sample.

Preparation consequence: any future identity must preserve G12/A99/R137 as the deposited/model sequence. It must not revert positions 12 or 137 to UniProt, and must not silently treat them as harmless background. Whether a future preparation policy needs special handling at these positions is for the separate preparation-authorization review after sample construct identity is clarified.

Evidence labels: deposited residues = WWPDB_DEPOSITION; variant/engineered labels = WWPDB_VALIDATION; reference residues = UNIPROT; broad “T4 lysozyme/L99A” description = PRIMARY_4W52_PUBLICATION; Addgene and non-4W52 literature = LATER_SECONDARY_LITERATURE; inference about origin remains PROJECT_INFERENCE.
