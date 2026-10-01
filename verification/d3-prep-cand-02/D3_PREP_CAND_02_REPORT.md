# D3-PREP-CAND-02 — Replacement candidate scientific admissibility

## Final classification

**D3-PREP-CAND-02 PASS — REPLACEMENT CANDIDATE SELECTED**

Exactly one candidate, **3ATL / BEN**, is selected for a separate preparation-authorization gate. This PASS closes candidate selection only. Full D3 remains HOLD, D4 remains BLOCKED, and DOCKING.RUN remains unavailable.

## Scope and method

This is a comparative, read-only review of the nine remaining D3-FP-01 candidates. Official RCSB mmCIF coordinate artifacts were fetched and retained; each file hash and size is recorded in CANDIDATE_SOURCE_INVENTORY.md and SHA256SUMS.txt. A standard-library parser at tools/audit_mmcif.py inventories models, revision history, polymer sequence and observed positions, missing atoms, alternate conformations, ligand components/instances, source/pH records, non-polymer counts, disulfides, and ligand-neighborhood distances. The parser does not add or move atoms and does not create prepared states.

Claims are separated by evidence class:
- **Deposited fact:** retained mmCIF categories and coordinates, checked against linked RCSB entry/experimental records.
- **Publication fact:** original structure papers identified in the candidate rows.
- **Database annotation:** current RCSB chemical-component dictionary identity/formula.
- **Inference:** interpretation of pH, pKa, contacts, water importance, construct relation, or D3 fitness.
- **Authorization proposal:** a question for a later gate; not an assignment made here.

The current canonical Mole Explorer Drive sources and prior D3-FP-01 and D3-PREP-DEC-01 evidence were reviewed before comparison. Raw mmCIF is source evidence, not PreparedReceptorState or PreparedLigandState. No molecule was prepared.

## Comparative conclusion

3ATL is the only candidate whose source identity, mature construct, complete modeled chain, exact ligand graph/instance, and lack of missing protein heavy atoms jointly support a bounded next authorization decision. It has a unique complete benzamidine instance in a complete mature trypsin chain and no receptor alternate conformations or sequence-difference records. This gives it a materially better construct/coordinate foundation than rejected 181L/BNZ.

This is not a claim that 3ATL has no scientific ambiguity. It has a likely amidinium charge at pH 8.5, a water-rich S1 site, calcium, and three DMS molecules. These require explicit owner and independent scientific decisions. Selection is defensible only because the questions are identifiable from authoritative records and can be evaluated before any transformation. An unresolved essential-water or ligand-charge issue is a stop condition.

## Candidate dispositions

| Candidate | Classification |
|---|---|
| 4W52 / BNZ | HIGH_PREPARATION_AMBIGUITY |
| 4W54 / PYJ | HIGH_PREPARATION_AMBIGUITY |
| 3ATL / BEN | ADMISSIBLE_FOR_NEXT AUTHORIZATION GATE |
| 1M17 / AQ4 | PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION |
| 3ERT / OHT | HIGH_PREPARATION_AMBIGUITY |
| 1FJS / Z34 | HIGH_PREPARATION_AMBIGUITY |
| 1HVR / XK2 | HIGH_PREPARATION_AMBIGUITY |
| 1EVE / E20 | NOT_SUITABLE_FOR_THIS D3 FIXTURE |
| 1STP / BTN | HIGH_PREPARATION_AMBIGUITY |

Full criteria and blockers are in CANDIDATE_SCIENTIFIC_ADMISSIBILITY_MATRIX.md; construct, chemistry, component, burden, representability, and provenance evidence are in corresponding matrix files.

## Source and scientific references

- 3ATL entry: [RCSB 3ATL](https://www.rcsb.org/structure/3ATL); [official mmCIF](https://files.rcsb.org/download/3ATL.cif); [experimental conditions](https://www.rcsb.org/experimental/3ATL).
- Primary structure paper: [Yamane et al., Acta Crystallographica D (2011)](https://doi.org/10.1107/S0021889811017717).
- Ligand identity: [RCSB CCD BEN](https://www.rcsb.org/ligand/BEN), benzamidine; compare [RCSB CCD BNZ](https://www.rcsb.org/ligand/BNZ), benzene.
- Benzamidine pKa compilation: [PubChem Benzamidine](https://pubchem.ncbi.nlm.nih.gov/compound/Benzamidine). pH-to-charge conclusion is inference, not measured bound protonation.
- Benzamidine/trypsin waters: [Water regulates the residence time of Benzamidine in Trypsin (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9481606/); [historical Asp189 structural analysis](https://doi.org/10.1016/0022-2836(74)90388-X).
- 4W52/4W54: [Merski et al.](https://doi.org/10.1073/pnas.1500806112).
- 1M17: [Stamos et al.](https://doi.org/10.1074/jbc.M207135200).
- 3ERT: [Shiau et al.](https://doi.org/10.1016/S0092-8674(00)81717-1).
- 1FJS: [Adler et al.](https://doi.org/10.1021/bi001477q).
- 1HVR: [Lam et al.](https://doi.org/10.1126/science.8278812).
- 1STP: [Weber et al.](https://doi.org/10.1126/science.2911722).
- 1EVE: [RCSB 1EVE](https://www.rcsb.org/structure/1EVE).

## Next artifact

D3_PREP_DEC_02_PROMPT.md is a standalone prompt for the candidate-specific authorization gate. It prohibits preparation/docking and requires fail-closed review of ligand charge, waters, components, state profile, and independent reviews.
