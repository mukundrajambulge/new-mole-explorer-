# Receptor chemical-state and hydrogen proposal — not approved

## Experimental pH and biological context

RCSB/mmCIF reports crystal growth at pH 6.9 and 277 K, in 2.0–2.2 M K/Na phosphate, 5 mM BME and 5 mM oxidized BME. RCSB says the complexes were prepared by soaking or vapor diffusion but does not identify which method applies to the deposited 3DMX complex, nor state a separate soak or ligand-binding solution pH. The primary paper abstract does not establish a 3DMX ligand-binding pH. No pH 7.0 or physiological-pH substitution is justified.

**Proposal only:** if the owner approves a candidate-specific profile, set `target_pH = 6.9`, `context = crystal-growth-condition proxy`, `context_uncertainty = ligand-soak/binding pH not reported`. This uses the only explicit deposited pH while not asserting that it is the solution pH during binding. Do not run an unvalidated automatic pKa or protonation predictor.

## Ionizable-site evidence

A deterministic read-only atom-coordinate audit is in `audit/ionizable_proximity.py`; its output is `IONIZABLE_RESIDUE_PROXIMITY.csv`. It measures source side-chain ionization-site heavy atoms against all six source BNZ carbons, separates GLU108 A/B, and includes true N/C termini. Closest groups in model 1 are:

| Receptor group | Minimum to BNZ | State relevance |
|---|---:|---|
| Tyr88 OH | 8.1425 Å | nearest ionizable group; outside 8 Å pair cutoff |
| Arg96 NE/NH1/NH2 | 8.5090 Å | outside cutoff |
| Asp89 OD1/OD2 | 8.9944 Å | outside cutoff |
| Glu108 A carboxylate | 9.7579 Å | outside cutoff; A occupancy 0.70 |
| Arg95 NE/NH1/NH2 | 9.8225 Å | outside cutoff |
| Asp92 OD1/OD2 | 10.2502 Å | outside cutoff |
| Lys124 NZ | 10.2830 Å | outside cutoff |
| HIS31 ND1/NE2 | 19.1250 Å | remote from BNZ pocket |
| N terminus (Met1 N) | 19.8776 Å | remote |
| C terminus (Leu164 O/OXT) | 22.7072 Å | remote |

There is one histidine, HIS31. Its ND1 is 2.672 Å from ASP70 OD2 and 3.305 Å from ASP70 OD1; NE2 is 3.476 Å from the LEU32 backbone O. This heavy-atom geometry favors neutral delta-N HID as a tautomer hypothesis, but hydrogens are absent and the nearby Asp–His interaction could alter His31 ionization. HIS31 charge is therefore explicitly unobserved; the proposed neutral HID state is not an experimental finding. The histidine is 19.125 Å from the nearest BNZ atom and does not affect the deposited reference-pose pair interactions under the current 8 Å cutoff.

The source contains standard ionizable Asp/Glu/Arg/Lys/Tyr residues plus the one HIS31; it contains no cysteine. Nearest titratable groups are outside the pair cutoff and BNZ has no donor/acceptor functionality. This bounds site-scoring materiality at the crystal pose; it does not make the receptor ChemicalState optional or prove a unique full-protein microstate.

## Candidate microstate hypothesis awaiting owner decision

If this state is selected, the explicit atom-state table would be produced from the exact construct and source mapping with no toolkit defaults: Asp/Glu side chains deprotonated; Arg/Lys side chains protonated; Tyr neutral; HIS31 neutral HID; N terminus protonated; C terminus deprotonated; no caps; no disulfides. Record each residue-level state in the ReceptorChemicalState and provenance. This is a single declared model at a crystallization-context proxy pH, not a claim of experimentally measured microstate or pKa certainty. Any predicted/observed alternative that could materially affect the accepted scoring environment remains AMBIGUOUS until explicitly resolved.

## Hydrogen policy proposal

- Add receptor hydrogens only after an explicit chemical state is accepted. Add no heavy atoms and no water/additive hydrogens because these are excluded from the dry scoring representation.
- Add one H1–H6 atom, each parent-mapped to BNZ C1–C6, with explicit coordinate-generation provenance. Use the CCD aromatic graph and ideal geometry aligned to the six fixed observed carbons; do not use the CCD model coordinates as 3DMX coordinates and do not minimize the benzene.
- Preserve all deposited receptor and ligand heavy-atom IEEE coordinates exactly. No minimization, side-chain repair, Asn/Gln/His flip, atom rename, atom remap, or force-field relaxation is allowed.
- Receptor hydroxyl/terminal H orientation behavior, exact hydrogen tool/version/runtime, and generated-coordinate serialization are not frozen because no authorized toolchain/profile exists.

The proposal cannot be executed until the owner decision and exact toolchain lock are recorded. No hydrogens were added in this lane.

## Explicit residue-state proposal and materiality audit

The source-coordinate audit found 49 ionizable side-chain groups across the 164-residue entity, plus the two true termini. The proposed explicit conventional states at the proposed `target_pH = 6.9` proxy are:

- Asp/Glu deprotonated: ASP 10, 20, 47, 61, 70, 72, 89, 92, 127, 159; GLU 5, 11, 22, 45, 62, 64, 108.
- Arg/Lys protonated: ARG 8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154; LYS 16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162.
- Tyr neutral: TYR 18, 24, 25, 88, 139, 161.
- Histidine: HIS31 neutral HID is the proposed tautomer; protonation versus neutrality is not crystallographically observed. Geometry proximity favors ND1 donation to ASP70, while the ASP70–HIS31 interaction can shift pKa.
- Termini: Met1 alpha-amino +1; Leu164 alpha-carboxylate -1, with source OXT present. No caps.
- Cysteine/disulfide: none in the deposited entity sequence.

Every assignment above is a declared proposal, not an observed state and not an owner-approved profile. No receptor hydrogen is deposited. Distance evidence classifies these sites as outside the current 8 Å ligand-pair cutoff for the frozen BNZ pose (nearest Tyr88 OH at 8.1425 Å); this bounds their direct score effect at that pose only. It does not remove them from `ReceptorChemicalState` or prove that pH alone selects their actual microscopic states.
