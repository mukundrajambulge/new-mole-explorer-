# BEN chemical identity and state review

## Identity and deposited graph

The deposited component is CCD BEN, benzamidine, formula C7H8N2. The current RCSB CCD entry reports formal charge 0 and a 17-atom component definition including hydrogen atoms. The 3ATL coordinates contain only the nine heavy atoms:

| CCD atom | Element | Observed in 3ATL |
|---|---|---|
| C1, C2, C3, C4, C5, C6 | C | Yes |
| C | C | Yes |
| N1, N2 | N | Yes |

The ring is C1–C6. Its C1 substituent is amidine carbon C; C is connected to N1 by a double bond and N2 by a single bond in the neutral CCD depiction. The deposited CCD neutral hydrogen assignment has one hydrogen on N1 and two on N2. Those hydrogens are not present in the experimental coordinate records.

CCD BNZ is a different compound: benzene C6H6 with six heavy atoms and no amidine carbon or nitrogen. The naming distinction is material: this candidate is 3ATL/BEN, not 181L/BNZ. Sources: [CCD BEN](https://www.rcsb.org/ligand/BEN), [CCD BNZ](https://www.rcsb.org/ligand/BNZ), and the embedded component categories in the frozen 3ATL mmCIF.

Fresh official CCD CIF retrievals on 2026-10-02 were parsed for comparison. BEN.cif SHA-256: a7ce813cbbac599168d4772f635ae23d7c6edb4d83a9891ebabcbe9e8bb66849. BNZ.cif SHA-256: 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61. These files were not copied into the repository; official endpoints are https://files.rcsb.org/ligands/download/BEN.cif and https://files.rcsb.org/ligands/download/BNZ.cif.

## Protonation and resonance

The crystal-growth condition lists pH 8.5. A compiled aqueous pKa for benzamidinium near 11.6 makes the +1 amidinium form strongly favored in bulk aqueous solution. The Henderson–Hasselbalch estimate is about 99.92% protonated at those values. This estimate is an inference that assumes the reported pKa applies and does not determine the bound-state microstate. It is not a measurement of proton location in the 3ATL crystal.

The deposited neutral CCD form must not be treated as the bound state simply because it is the source component graph. Conversely, the likely +1 state is not authorized solely by the bulk pKa inference. If considered in a future candidate gate, the proposed state to review is benzamidinium +1, C7H9N2+, with explicit bond-order/resonance convention, atom-UID mapping, hydrogens, formal-charge assignment, and donor/acceptor rules. The current evidence does not justify choosing an atom-localized resonance form or placing the additional hydrogen on N1 versus N2 without an explicit reviewed state definition. No automatic protomer enumeration is allowed.

The active-site context includes an Asp189 carboxylate near the amidine group: the source audit reports a minimum 2.847 Å heavy-atom separation between BEN and Asp189. This supports the chemical plausibility of a cationic inhibitor but does not itself locate a proton or assign exact atomwise formal charges.

## Compatibility with the current scorer

Current ME_DOCKING_V1_VINA_CLASSIC_1_0 does not consume atomic partial charges as a score term. That does not make formal charge irrelevant: current ChemicalState and ME_XS_TYPING_V1_1_0 require explicit chemical state, valence, formal charge, hydrogens, and state-dependent donor/acceptor assignment. An unresolved ligand microstate cannot receive a canonical typing assignment. PHD-V2-06 also does not permit unknown-charge relabeling or a zero-charge fallback.

The neutral and protonated amidine representations imply different ChemicalState content and potentially different donor/acceptor typing; exact XS types and atom mapping therefore cannot be sealed here. No partial charges, PDBQT columns, or prepared ligand representation were generated.

## Kinematics and torsion metadata

The deposited BEN graph contains an acyclic C1–C single bond between the aromatic ring and amidine carbon. The final D3 search kinematic model and scorer N_tors value must be derived by the approved, pinned representation rules and kept distinct. No exact torsion count is assigned in this gate. No rotatable-bond perception, ligand preparation, PDBQT conversion, or D3 full-pose validation was run.

## Disposition

**BEN identity: verified.**
**Likely aqueous protomer: +1 amidinium (inference).**
**Bound ChemicalState, atomwise resonance/charge mapping, hydrogen placement, and canonical digest: unresolved and unapproved.**
**Candidate admission: rejected independently on the water-profile mismatch; these ligand-state blockers also prevent authorization.**

## References

- [RCSB CCD BEN](https://www.rcsb.org/ligand/BEN)
- [RCSB CCD BNZ](https://www.rcsb.org/ligand/BNZ)
- [Benzamidine pKa compilation](https://mcb.berkeley.edu/labs/krantz/pdf/pKa_compilation.pdf)
- [UniProt/PubChem chemical identity and conjugate-acid relationship](https://pubchem.ncbi.nlm.nih.gov/compound/Benzamidine)
- [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit) and [PHD-V2-06](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit).
