# BNZ chemical-state policy

## Source and reference evidence

The deposited ligand is BNZ, benzene, formula C6H6. The frozen source has six observed heavy atoms C1–C6 in one model, with occupancy 1.0. The official RCSB chemical component identifies a six-member aromatic ring, neutral charge, no chiral atoms, and no tautomer/protomer alternatives relevant to ordinary benzene identity: https://www.rcsb.org/ligand/BNZ. The 181L-specific source atom mapping is in source_artifacts/181L_current.cif.

The chemical graph is a six-carbon aromatic ring. Benzene has zero chemical rotors. That fact does not collapse distinct torsion concepts: a future pinned representation must separately record search degrees of freedom, PDBQT branch/TORSDOF conventions, and the D3 Vina scorer N_tors assignment. Prior D3-IR-01 analysis found a terminal-edge count disagreement between PHD-V2-06 and D2-related material; the exact selected representation should be checked even though BNZ itself has no chemical rotor.

## Proposed future contract

- Bind the six source heavy atoms by stable atom identities to a reviewed benzene graph and exact coordinate state.
- Record the atom-name mapping C1–C6 and bond/aromaticity representation explicitly.
- Preserve the deposited heavy-atom coordinates exactly for a frozen-pose scoring fixture.
- If the backend requires explicit H atoms, derive six hydrogens under the approved tool and deterministic atom mapping; retain the graph and parent mappings and do not infer hydrogen coordinates from the source.
- Record charge 0 and formula C6H6 as chemical-component reference evidence, and independently verify the selected software representation.
- Record separately the ligand chemical graph, coordinate-state digest, search torsion model, torsion serialization, and scorer N_tors.

This policy is a proposal and not a ligand preparation. No ligand state was generated and no PDBQT was written. DEC-09 is pending owner/reviewer acceptance.