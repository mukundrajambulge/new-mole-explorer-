# Candidate selection decision

## Decision

Select no candidate for D3-PREP-DEC-03.

No detailed candidate meets CORE_DRY_V1_ADMISSIBLE. The allowed decision is a finite HOLD, not selection of the least-blocked structure. The lane classification is:

**D3-EXT-FIX-01 HOLD — PROMISING CANDIDATES REQUIRE SOURCE RESOLUTION**

## Candidate dispositions

| Candidate | Classification | Controlling reason |
|---|---|---|
| 4W52 / BNZ | PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION | mmCIF maps R12G and I137R as variants, L99A as engineered and LEHHHHHH as expression tag, but primary sample provenance for the two variants and physical C-terminal tag cleavage are unresolved; terminal chemistry cannot be frozen. |
| 5JWT / BNZ | STRUCTURALLY_INCOMPLETE | Three unobserved receptor positions and two nearby receptor alternate conformations. |
| 9BZT / BNZ | CURRENT_SCORER_UNSUPPORTED | Short AIB-containing nonstandard peptide receptor and I77 co-ligand are outside the ordinary supported receptor chemistry. |
| 4EMN / BEN | CHEMICAL_STATE_AMBIGUOUS | BEN amidine/amidinium state, six missing Arg atoms and near-site sulfate policy remain unresolved. Water counts alone are not treated as a rejection. |
| 2OXS / BEN | PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION | BEN chemical state, near-site sulfate role and source-specific component policy need resolution. Calcium is 22.53 Å from BEN and is not a direct ligand-contact blocker. |
| 7BNH / BEZ | CHEMICAL_STATE_AMBIGUOUS | Benzoic acid/benzoate state and nearby MES/water environment have no source-grounded frozen policy. |
| 6TGU / N92 | STRUCTURALLY_INCOMPLETE | Thirty-seven polymer positions are unobserved; ligand has split occupancy and three nearby receptor alternate residues. |
| 1MUP / TZL | WATER_DEPENDENT | The raw model has two cavity waters in the ligand shell and the primary MUP-I report describes water-mediated polar-group interactions; CORE_DRY_V1 has no approved explicit-water representation. |
| 7FEZ / 4I1 | CHEMICAL_STATE_AMBIGUOUS | Long-chain acid charge state and four nearby receptor alternate residues prevent a single justified state. |
| 3BCJ / FIS | NOT_SUITABLE | Partial ligand occupancy, dense water shell, citrate adjacency, local receptor altlocs and a very short water–ligand coordinate distance require a more complex source/validation path. The water count is not called proof of essentiality. |

## Why no next authorization prompt was generated

The required selected-candidate classification is CORE_DRY_V1_ADMISSIBLE. None qualifies. Therefore SELECTED_EXTERNAL_FIXTURE.md and D3_PREP_DEC_03_PROMPT.md are intentionally absent. Creating a candidate-specific preparation authorization prompt for a blocked structure would imply a scientific selection this lane did not make.

The next step is to resolve whether source records can close the 4W52 construct/mutation question, or to choose a future fixture strategy through the escalation record. Any later candidate review must be a separate gate. No preparation, protonation, hydrogen addition, atom repair, scoring, docking or direct/grid experiment is authorized by this result.
