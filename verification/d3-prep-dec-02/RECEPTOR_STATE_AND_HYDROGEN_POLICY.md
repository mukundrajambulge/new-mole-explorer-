# Receptor chemical state and hydrogen policy disposition

## What the source fixes

The deposited source fixes the sequence and heavy-atom coordinate evidence, one experimental model, a complete mature chain, the six disulfide connections, and the resolved component/water inventory. It records crystal-growth pH 8.5 at 277 K. It does not record hydrogen positions, a final receptor protonation profile, water orientation, or an approved preparation method.

## Pocket-neighborhood review inventory

Distances below are minimum side-chain-heavy-atom to BEN-heavy-atom distances recalculated from the source. They identify review obligations; they are not a universal cutoff or a declaration that every side chain influences the score.

| Label position | Author residue | Side-chain atom | Minimum to BEN | State question |
|---:|---|---|---:|---|
| 171 | Asp189 | OD2 | 2.847 Å | Asp carboxylate and benzamidinium interaction; both chemical states need explicit review |
| 206 | Tyr224 | OH | 4.267 Å | Phenol donor/acceptor perception and H orientation |
| 40 | His58 | NE2 | 5.590 Å | Histidine tautomer/protonation and exact H orientation |
| 152 | Tyr170 | OH | 5.766 Å | Phenol state and donor/acceptor perception |
| 176 | Asp194 | OD2 | 6.176 Å | Acidic state and nearby receptor-state coupling |
| 84 | Asp102 | OD2 | 7.936 Å | Acidic state; catalytic-triad context |
| 131 | Tyr149 | OH | 8.867 Å | Phenol state if included in the relevant site neighborhood |
| 197 | Cys215 | SG | 4.138 Å | Disulfide-linked to Cys191; not a free thiol |
| 173 | Cys191 | SG | 5.380 Å | Disulfide-linked to Cys215; not a free thiol |
| 162 | Cys180 | SG | 9.107 Å | Deposited disulfide to Cys166 |
| 41 | Cys59 | SG | 8.554 Å | Deposited disulfide to Cys43 |
| 25 | Cys43 | SG | 8.576 Å | Deposited disulfide to Cys59 |

The remaining source histidines are label 23 / author 41, whose imidazole is 10.552 Å from BEN, and label 73 / author 91, at 19.014 Å. The near-site histidine is label 40 / author 58 at 5.590 Å. The mature N-terminal Ile is label position 1 and lies approximately 8.34 Å from the nearest BEN heavy atom; the terminal Asn is label position 223 and is at least 27.88 Å away by the nearest heavy-atom comparison. Their existence and sequence context are source facts; protonation and terminal hydrogen policy are not thereby assigned.

The local source also places Ser190 close to BEN (2.819 Å minimum heavy-atom separation) and the catalytic Ser195 at 3.753 Å. These geometric facts reinforce that this is a polar and chemically coupled protease pocket. No hydrogen bonds are asserted solely from heavy-atom distance.

## State choices not frozen

No final pH-to-microstate policy, histidine tautomer, Asp/Glu state, Lys/Arg state, terminal charge, cysteine state, hydrogen placement/orientation, side-chain flip, hydrogen optimization, or receptor force-field assignment is approved. Bulk pH is not a substitute for residue-level state evidence. The six disulfide cysteine pairs must remain disulfides; treating their cysteines as isolated thiols would change chemistry.

The water network cannot be represented by the only approved ordinary V1 receptor profile. Therefore this gate does not prepare a receptor, choose hydrogens, or propose a deterministic hydrogenation profile for 3ATL.

## Controlling contract

PHD-V2-03 requires immutable, explicit receptor identity, biological state, coordinate state, preparation profile, components, chemical states, and provenance. PHD-V2-08 defines CORE_DRY_V1 as having no explicit scoring water and blocks it when essential water is part of the claimed pocket model. PHD-V2-15 excludes unvalidated automatic protonation and hydrogen-generation choices from the core.

## Sources

- Frozen source and prior read-only measurements: verification/d3-prep-cand-02/source_artifacts/3ATL.cif and CANDIDATE_RAW_AUDIT.json.
- [UniProt P00760](https://rest.uniprot.org/uniprotkb/P00760.txt).
- [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit), [PHD-V2-08](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit), and [PHD-V2-15](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNV8rTVuTZmiMicjHIVEfmpM/edit).
