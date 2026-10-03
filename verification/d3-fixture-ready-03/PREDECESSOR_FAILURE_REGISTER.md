# Predecessor failure register

This register preserves earlier dispositions. Retired candidates remain closed; this task does not reselect or repair them.

| Predecessor | Prior disposition / controlling failure | Use in this task |
|---|---|---|
| 181L / BNZ | Receptor source contains an unresolved construct/terminal interpretation, so a true physical terminus and exact receptor state could not be frozen. | Failure-pattern reference only; not reopened. |
| 3ATL / BEN | Bound BEN depends on a documented water-mediated recognition network that CORE_DRY_V1 cannot score explicitly; the BEN state also differs from a simple neutral aromatic ligand. | Failure-pattern reference only; not reopened. |
| 4W52 / BNZ | Construct mutations and an unmodeled C-terminal His-tag/continuation leave terminal chemistry/source identity unresolved. Latest source gate retired it. | Failure-pattern reference only; new accession 3DMX is audited independently and is not treated as new evidence about 4W52. |
| 9I7O / RTL | Latest D3-PREP-DEC-03 rerun is HOLD; seven partial sidechains omit 21 heavy atoms, including near-ligand LEU103/ASN104; mature Leu17 and AEPE loop are unmodeled; no validated heavy-atom repair or approved preparation pH/toolchain. | Rejected and closed. No repair or candidate rescreen. Corrected 178-residue interpretation is in `9I7O_RECONCILIATION_REFERENCE.md`. |
| D3-EXT-FIX-01 | Its finite external screen found no admissible candidate; 4W52 remained source-unresolved, and the other candidates failed structure, chemistry, water, or supported-receptor constraints. | Used to avoid repeating the same pool and to define the failure-pattern controls. |
| D3-FIXTURE-COHORT-02 | Its 28-entry retinol cohort selected 9I7O as source-resolved, but did not yet apply the new atom/terminus preparation gate. | The 14 still-open detailed entries were rescreened. The 9I7O entry was excluded from that rescreen by explicit instruction. |
| D3-PREP-DEC-03 cohort prompt | Asked whether a later isolated preparation review of 9I7O should be authorized; it did not authorize preparation. | Read as historical request; superseded by the latest rerun HOLD. |
| D3-PREP-DEC-03 latest rerun | `79ff8463f93f36a19b7a97bcfdb33aaa5e7fb173` records HOLD and no preparation authorization. | Controlling predecessor state and evidence parent. |

## Boundary

No predecessor result is converted into permission for preparation, full-pose scoring, docking, scorer changes, PyMOL changes, or D4. Full D3 remains HOLD, D4 remains BLOCKED, and `DOCKING.RUN` remains unavailable.
