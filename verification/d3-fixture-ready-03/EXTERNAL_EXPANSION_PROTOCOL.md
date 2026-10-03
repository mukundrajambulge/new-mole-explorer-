# One-time external expansion protocol

## Trigger and bound

The 14 still-open detailed entries in the existing retinol cohort produced no preparation-ready candidate. One bounded external pass was then made against current RCSB benzene-bound T4 lysozyme records. The fixed accession set was:

`1L83, 1L84, 220L, 223L, 227L, 3DMX, 3GUJ, 3HH4, 4I7J` (nine entries total).

The screen sought a neutral, single-graph aromatic ligand with deposited experimental coordinates, a protein receptor, and enough source metadata to identify the construct and biological assembly. It did not broaden into charged BEN-like chemistry or run a second search generation. Fresh official RCSB mmCIF, entry/polymer/assembly metadata, and validation PDFs for the four deep external finalists were retained under `source_artifacts/current_rcsb/`; every retained input has a SHA-256 entry in the source manifest.

## Fixed-batch screen

| Entry | Screen finding | Disposition |
|---|---|---|
| 1L83 | BNZ 6/6, occupancy 1.0; C-terminal entity residues 163–164 absent. | Rejected: false C terminus. |
| 1L84 | BNZ 6/6, occupancy 1.0; C-terminal entity residues 163–164 absent. | Rejected: false C terminus. |
| 220L | BNZ 6/6, occupancy 1.0; C-terminal entity residues 163–164 absent. | Rejected: false C terminus. |
| 223L | BNZ 6/6, occupancy 1.0; C-terminal entity residues 163–164 absent. | Rejected: false C terminus. |
| 227L | BNZ 6/6, occupancy 1.0; C-terminal entity residues 163–164 absent; 5 waters ≤5 Å and 15 ≤8 Å (nearest 2.9646 Å). | Rejected: false C terminus and unresolved dry-profile water state. |
| 3DMX | BNZ 6/6, occupancy 1.0; complete 164-residue receptor, all expected heavy atoms, both termini/OXT, continuous chain. | Selected after deep preflight. |
| 3GUJ | BNZ 6/6, occupancy 1.0; entity C-terminal residues 163–164 absent; nearest water 3.7003 Å; CME 7.8771 Å. | Rejected: false C terminus plus local water/component policy. |
| 3HH4 | BNZ 6/6, occupancy 1.0; all 164 residues modeled but C-terminal OXT absent; four alternate residues lie within 8 Å. | Rejected: missing true terminal heavy atom. |
| 4I7J | BNZ 6/6, occupancy 1.0; N-terminal 1–12 and internal residue 59 absent; 27 heavy atoms missing across 11 modeled residues; one alternate Lys108 at 6.3461 Å. | Rejected: unresolved N/tag/internal sequence and receptor incompleteness. |

The deep finalist set was 1CRB from the existing cohort plus 3DMX, 3HH4, 227L, and 4I7J from the fixed external batch. The other four external entries were stopped at the explicit terminal-gap filter. 3DMX is a distinct accession and source record; its admission does not reopen 181L or 4W52.

## Stop rule

The one allowed expansion is complete. No further broad, targeted, or opportunistic fixture search is proposed in this lane.
