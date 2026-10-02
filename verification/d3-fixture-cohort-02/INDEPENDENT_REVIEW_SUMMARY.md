# Independent source and structural review

An independent read-only review assessed 9I7O for whether it can proceed directly to a candidate-specific preparation-authorization prompt. Verdict: **qualified yes**, provided the prompt names the natural A/B mixture, the pH discrepancy, and the unresolved internal loop.

The review confirmed the source paper identifies lyophilized bovine-milk beta-lactoglobulin powder, Sigma L3908, rather than a described recombinant tagged construct. The record is mapped to natural Bos taurus P02754. It does not establish source-lot genotype proportions; crystal alternate occupancies describe the model, not a bulk sample measurement.

The model's two natural sequence sites (precursor 80/134; mature 64/118) have major/minor occupancies around 0.746/0.254. Phe105 rotamer occupancy 0.720/0.280 matches RTL occupancy 0.720. The minor Phe105 rotamer clashes with retinol, so any later source state must choose a coherent maximum-occupancy state and preserve this decision in the record.

UniProt precursor positions 1–16 are signal peptide; mature Leu17 is not modeled. Internal precursor positions 127–130 (mature 111–114, AEPE) are unresolved. A homolog places the internal segment away from the ligand site; this is an inference, not direct evidence from 9I7O. The review recommended flagging the gap and not rebuilding it.

The article specifies crystallization at pH 8.5, while the repository metadata lists 7.4. The prompt discloses both and asks the future authorization decision to affirm the pH basis. The reviewer found no direct modeled water bridge at the retinol hydroxyl and no identified literature requirement for water-supported binding; omission remains a documented CORE_DRY_V1 limitation.

Sources: [primary article](https://doi.org/10.1016/j.foodchem.2026.150783), [RCSB 9I7O](https://www.rcsb.org/structure/9I7O), [UniProt P02754](https://www.uniprot.org/uniprotkb/P02754). Review did not edit production files or execute preparation.
