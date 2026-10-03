# Source-audit reconciliation: sequence positions 179-180

## Finding

The D3-FIXTURE-COHORT-02 source-tractability matrix row for 9I7O lists the missing label-sequence positions as 1-17, 127-130, 179 and 180. The final two values are outside the deposited entity sequence and are not missing polymer residues.

The current 9I7O mmCIF and its retained selected-candidate audit agree on a 178-residue entity:
- expected polymer sequence length: 178;
- observed label sequence range: 18-178;
- missing label sequence positions: 1-17 and 127-130 only;
- residue 178 is modeled;
- 157 distinct sequence positions are observed (178 minus the 21 genuinely unobserved sequence positions).

The audit's count of 159 observed residue records includes alternate-conformation records; it is not the count of distinct polymer sequence positions. The matrix's 157 observed value is consistent with unique sequence positions. Only the appended 179 and 180 values are inconsistent.

## Resolution and effect

Treat 179 and 180 in the cohort matrix row as a source-tractability-matrix data error. The exact source polymer entity, current RCSB entry, and candidate audit establish sequence length 178. No additional C-terminal gap exists, and the modeled C-terminal residue is Ile178. This correction does not change the selected receptor, ligand, coordinate source, or HOLD decision.

The cohort matrix is retained byte-for-byte as predecessor evidence. This reconciliation is additive and does not edit the predecessor lane. The raw current RCSB mmCIF, source audit JSON, context JSON, matrix snapshots, and original cohort manifest are retained or referenced in this lane:
- source_artifacts/current_rcsb/9I7O.cif;
- source_artifacts/predecessor_snapshot/9I7O_B_A_audit.json;
- source_artifacts/predecessor_snapshot/9I7O_context.json;
- source_artifacts/predecessor_snapshot/COHORT_SOURCE_TRACTABILITY_MATRIX.csv;
- source_artifacts/predecessor_snapshot/cohort_SHA256SUMS.txt.

## Reproducibility note

The current RCSB mmCIF download was byte-identical to the committed cohort mmCIF. The 149-entry predecessor source manifest was independently checked: 149 listed artifacts, all present and hash-matching, zero discrepancies. See SOURCE_SHA256SUMS.txt for the rerun lane's retained-source hashes.
