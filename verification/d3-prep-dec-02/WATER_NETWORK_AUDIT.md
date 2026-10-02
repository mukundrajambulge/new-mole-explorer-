# 3ATL/BEN crystallographic water network audit

## Method and limits

Distances below were recalculated from the frozen 3ATL mmCIF using the predecessor's read-only mmCIF parser and Euclidean distances between model-1 heavy-atom coordinates. Water-to-ligand distance is the minimum to any of the nine BEN heavy atoms. The nearest protein atom is the minimum water-oxygen to protein-heavy-atom distance in chain A. Occupancy and B factor are copied from the deposited water atom. A heavy-atom distance does not prove a hydrogen bond because no water hydrogens or orientations are deposited.

The eight waters at or below 5 Å and all sixteen at or below 8 Å are listed. Water identifiers are the deposited author residue numbers in author chain A; label asym for water is G.

| Water | Occupancy | B factor (Å²) | Nearest BEN atom / distance (Å) | Nearest protein atom / distance (Å) |
|---:|---:|---:|---|---|
| 302 | 1.00 | 33.74 | N2 / 2.747 | Lys220 O / 2.792 |
| 350 | 1.00 | 16.34 | N1 / 2.894 | Val223 O / 2.864 |
| 467 | 1.00 | 22.94 | C3 / 3.371 | Gly212 O / 3.190 |
| 524 | 1.00 | 40.65 | C4 / 3.622 | Ser195 OG / 3.717 |
| 354 | 1.00 | 21.22 | C4 / 3.649 | Ser210 O / 2.835 |
| 498 | 1.00 | 21.12 | C4 / 4.285 | Ser195 OG / 2.576 |
| 332 | 1.00 | 18.04 | N2 / 4.446 | Ser213 O / 2.739 |
| 335 | 1.00 | 13.36 | N1 / 4.807 | Tyr224 OH / 2.592 |
| 372 | 1.00 | 17.81 | N2 / 5.643 | Lys220 O / 2.874 |
| 377 | 1.00 | 26.62 | C3 / 5.709 | Gly212 O / 3.047 |
| 534 | 1.00 | 35.26 | C4 / 6.019 | His58 ND1 / 3.525 |
| 331 | 1.00 | 15.91 | N1 / 6.545 | Lys188 O / 2.746 |
| 277 | 1.00 | 42.28 | C2 / 6.650 | Gln192 NE2 / 3.362 |
| 353 | 1.00 | 21.23 | N2 / 7.277 | Ser144 O / 2.637 |
| 336 | 1.00 | 16.50 | C2 / 7.618 | Ser213 OG / 2.990 |
| 500 | 1.00 | 22.34 | N2 / 7.979 | Gln217 O / 2.616 |

The ligand also contacts the polar S1 pocket directly: the source audit reports 2.847 Å minimum heavy-atom separation to Asp189 and 2.819 Å to Ser190. These are deposited geometric observations, not final protonation or hydrogen-bond assignments.

## Structural interpretation

The primary study by Ansari, Rizzi and Parrinello identifies its state B as the crystallographic trypsin–benzamidine complex, citing 3ATL as an example. It reports a long-lived W1 water connecting the ligand to trypsin Tyr228 and Ser190, and an average of five waters in the reservoir below Asp189. A neutron-crystallography study independently reports W1 trapped at a particular configuration above Tyr228 upon complex formation and a water reservoir flanking Asp189.

Those papers use functional water-site labels; this audit does not assert a one-to-one identity between a paper's W1 label and any one 3ATL author water number. The combined evidence does establish that the BEN–trypsin bound state is not scientifically equivalent to an arbitrary water-free pocket. The retained coordinate file also contains multiple waters in direct heavy-atom proximity to BEN and the S1 region.

## Controlling-profile assessment

Current CORE_DRY_V1 excludes water from the scoring representation. PHD-V2-08 permits removal of dispensable bulk/unclassified water only when its role, reason, and provenance are explicit. It classifies a required ligand-recognition bridge or pocket-dependent conserved water as unsupported under ordinary dry V1. A future fixed-water profile must define water coordinates, orientation/hydrogens, protonation, donor/acceptor roles, typing, score terms, occupancy evidence, and validation; no such profile is approved in the current canonical docs.

No source-grounded evidence justifies classifying the benzamidine recognition network as dispensable for this intended fixture. Deleting the eight close waters or retaining selected oxygen atoms as ordinary protein atoms would be an unsupported change in model. Since no approved water-capable profile exists, the generated prompt's stop condition applies and 3ATL/BEN is rejected for this fixture.

## Sources

- Frozen coordinate artifact: verification/d3-prep-cand-02/source_artifacts/3ATL.cif; SHA-256 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46.
- Reproducible prior inventory: verification/d3-prep-cand-02/CANDIDATE_RAW_AUDIT.json and NONPOLYMER_COMPONENT_MATRIX.md.
- [Ansari, Rizzi & Parrinello, Nature Communications 13, 5438 (2022)](https://www.nature.com/articles/s41467-022-33104-3).
- [Neutron crystallography of trypsin water networks, Nature Communications (2018)](https://www.nature.com/articles/s41467-018-05769-2).
- [PHD-V2-08](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit) and [Normalized Docking Requirements](https://docs.google.com/document/d/1_M2RzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY/edit).
