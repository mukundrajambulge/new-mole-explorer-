# Evidence hierarchy

Use the following labels for claims in this gate. A database annotation is not silently promoted to an experimental method statement, and a later construct is not treated as the 4W52 sample.

| Evidence class | Use in this audit | Limit |
|---|---|---|
| PRIMARY_4W52_PUBLICATION | Merski et al. 2015 main paper: identifies 4W52 as benzene, describes the T4 lysozyme/L99A study, reports the molecular-replacement and multiconformer-refinement approach and points cloning/purification details to SI Methods | Does not state R12G/I137R origin or physical tag cleavage in accessible main text |
| CORRECTED_SUPPORTING_INFORMATION | Correction notice says the SI Appendix was published incorrectly and corrected online | Actual corrected SI file could not be retrieved; no SI contents are claimed as reviewed |
| EXACT_CONSTRUCT_REFERENCE | No exact 4W52 construct map or primary plasmid record was located | pET29 metadata is not a sequence map; other constructs are not proof of this sample |
| WWPDB_DEPOSITION | Current mmCIF/entity/API: deposited 172-residue sequence, model coordinates, source/host/vector annotations, component instances and unobserved positions | Deposited sequence and tag metadata do not alone prove physical retention/cleavage after purification |
| WWPDB_VALIDATION | Current full report: 12/137 variant, 99 engineered, 165–172 expression tag, model coverage, geometry and ligand density statistics | Labels do not explain mutation origin or sample processing |
| UNIPROT | Current P00720 164-residue sequence used as reference | Reference sequence is not the engineered experimental construct |
| LATER_SECONDARY_LITERATURE | Addgene plasmid 18110 and later construct reports used only as corroboration that related substitutions/tagged proteins exist | No verified linkage to the 4W52 plasmid or sample |
| PROJECT_INFERENCE | Distances, local-shell relevance and whether a dry profile could omit distant components, computed from frozen coordinates | Must remain explicitly an inference; it does not override source ambiguity |

## Controlling disputed facts

- Exact deposited sequence and the identities at 12, 99, 137 and 165–172: WWPDB_DEPOSITION, checked against WWPDB_VALIDATION and UNIPROT.
- Intentional versus background origin of R12G/I137R: unresolved by PRIMARY_4W52_PUBLICATION and inaccessible corrected SI; no EXACT_CONSTRUCT_REFERENCE linked to 4W52.
- Whether LEHHHHHH was cleaved, retained but disordered, or absent from the physical crystallization sample: unresolved. Neither coordinate absence nor entity metadata answers it.
- BNZ identity and graph: current CCD plus WWPDB_DEPOSITION.
- Water/EPE distances and direct-score shell: PROJECT_INFERENCE from frozen WWPDB_DEPOSITION coordinates.
- Alternate occupancy and coordinates: WWPDB_DEPOSITION, with global refinement context from PRIMARY_4W52_PUBLICATION; per-4W52 SI interpretation remains unavailable.
