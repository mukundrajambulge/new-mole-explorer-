# Fixture eligibility matrix

Eligibility means that a single frozen experiment can be reconstructed from already-existing, D2-sealed receptor and ligand states, their exact shared SearchRegion and profiles, and source-to-state provenance. No candidate below meets that rule. Primary disposition is NOT_PREPARED for each named candidate; the additional blockers are evidence gaps and scientific choices, not permission to fill them by default.

| Candidate | Current disposition | Evidence-grounded blockers |
|---|---|---|
| 181L / BNZ | NOT_PREPARED | No PreparedReceptorState or PreparedLigandState, no chemical/coordinate-state digests, profile, typing, canonical digest, SearchRegion, or shared experiment manifest. Receptor construct discrepancy T54/A97/A99 versus L99A annotation unresolved; ASN163 and LEU164 absent; protonation, histidine, hydrogen, and component policy unresolved. |
| 4W52 / BNZ | NOT_PREPARED | No sealed receptor/ligand states or shared experiment digests. Met106 and Arg119 alternate conformers lie within the scoring cutoff; C-terminal missingness and conformer policy unresolved. |
| 4W54 / PYJ | NOT_PREPARED | No sealed receptor/ligand states or shared experiment digests. Receptor alternate locations, PYJ A/B ligand coordinates, and missing heavy atoms on Lys83 near the site leave exact coordinate/chemical state unresolved. |
| 3ATL / BEN | NOT_PREPARED | No sealed receptor/ligand states or shared experiment digests. Eight waters are within 5 Å, nearest 2.747 Å; BEN charge/protomer, pH-derived state, and water/component policy are unresolved. |
| 1M17 / AQ4 | NOT_PREPARED | Raw-source audit only; no sealed pair or shared digests. 21 residues are missing; site water HOH A10 and ASP A831 0.5/0.5 alternate locations at 3.105 Å leave receptor coordinate and chemical states unresolved. |
| 3ERT / OHT | NOT_PREPARED | Prior-screen record only. No re-established raw-source provenance, exact receptor/ligand state, pair digests, component policy, SearchRegion, or shared profile set. Reported context includes 247/261 residues, dimer context, and a tertiary-amine state requiring explicit review. |
| 1FJS / Z34 | NOT_PREPARED | Prior-screen record only. No re-established raw-source provenance or sealed state pair. Ligand amidine/hydroxy state, calcium/chloride/glycerol component policy, site distances, SearchRegion, and shared profile set are unresolved. |
| 1HVR / XK2 | NOT_PREPARED | Prior-screen record only. No re-established raw-source provenance or sealed state pair. Water-mimic ligand, CSO residues, dimer context, component policy, SearchRegion, and shared profile set require source audit and review. |
| 1EVE / E20 | NOT_PREPARED | Prior-screen record only. No re-established raw-source provenance or sealed state pair. Reported 534/543 residue coverage, glycans, and solvent-mediated site require exact source and component audit; no ligand state, SearchRegion, or shared profile set exists. |
| 1STP / BTN | NOT_PREPARED | Prior-screen record only. No re-established raw-source provenance or sealed state pair. Tetramer assembly, 121/159 position coverage, loop/water context, exact ligand state, SearchRegion, and shared profile set are unresolved. |

## Noncandidate tool artifacts
Synthetic PDBQT/SDF cases under apps/api/src/docking/fixtures/d3-ir-02/ are scorer-input and torsion/reference fixtures. Their fixture-provenance.json describes synthetic small-molecule inputs and tool/reference artifacts, not a receptor–ligand experimental pair. For scientific full-pose fixture admission they are PROVENANCE_INSUFFICIENT: they have no candidate receptor identity, D2 receptor/ligand prepared-state pair, or shared SearchRegion/profile/digest chain.

## Evidence basis
The first five candidate classifications follow the D3-VAL-01 candidate inventory, audit report, and owner decision in the [D3-VAL-01 evidence folder](https://drive.google.com/drive/folders/1KVXKzwacjAjQSJri2VzP7byXpNt8F08H), and the [D3-RA-01 evidence folder](https://drive.google.com/drive/folders/18a3MguBMgcnYVfMTBdgHQ9XxetQHfinQ). The 1M17 raw structure audit is also recorded in the [D3-DATA-01 report](https://drive.google.com/file/d/1tP119GTKojUTDnfGEISAQmQ_ZimUDQyT/view). The current [D3-SCI-03 manifest](https://drive.google.com/file/d/1khcukrEnWgHyBcZ6SOm7hwBb2Hj-W0M8/view) admits zero qualifying fixtures.
