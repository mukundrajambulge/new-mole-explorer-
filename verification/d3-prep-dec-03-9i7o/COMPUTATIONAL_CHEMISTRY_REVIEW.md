# Computational-chemistry review material — 9I7O

## Scope and status

This is Codex's analysis for the preparation-authorization gate, not an independent human computational-chemist approval and not a preparation. Reviewer disposition is pending.

## Ligand graph, state, and torsions

The exact source ligand is RCSB CCD RTL (retinol), formula C20H30O, formal charge 0, 21 heavy atoms, all-trans 2E,4E,6E,8E, and zero tetrahedral stereocenters. All 21 deposited ligand heavy atoms are observed at occupancy 0.720. The frozen CCD file hash is listed in SOURCE_AND_STATE_FREEZE.md. The source graph maps to supported CORE_DRY_V1 types C_H ×19, C_P ×1 and O_DA ×1.

No alternate ligand conformation or unsupported element is present. The CCD neutral alcohol state is the source-supported ligand graph. No tautomer or protomer enumeration is requested or authorized. Experimental ligand heavy-atom coordinates are retained as evidence; no conformer generation, minimization, or coordinate change occurred.

Under PHD-V2-04's chemistry-based rotor semantics, Codex identifies C14–C15 as one candidate search torsion: an acyclic single bond whose rotation moves the terminal CH2OH heavy-atom group. The ring is rigid; single bonds within the conjugated polyene are not ordinary search rotors; methyl-axis and C15–O1 rotations move only terminal hydrogens and are excluded from search DOFs. Therefore a candidate search_torsion_count of 1 is plausible, but **not sealed** because no exact root/tree, atom mapping, axis, kinematic profile execution, or LigandKinematicModel digest exists.

PHD-V2-06 separates the real-valued Vina scorer quantity N_tors_vina from search DOF count and from PDBQT TORSDOF. No scorer quantity is assigned here. Do not infer it from the candidate search count or an unapproved Meeko conversion.

## pH and receptor chemistry

The primary paper distinguishes pH 7.4 in the initial ammonium-bicarbonate dissolution buffer from pH 8.5 in the beta-LG/retinol complex-formation and crystallization method. RCSB metadata separately labels crystal growth pH 7.4. No soaking pH is described. Thus 8.5 is the most specific documented final crystallization condition; 7.4 is a documented initial buffer and repository annotation whose provenance is unclear. Neither establishes crystal-internal pH or a residue-specific protonation pattern.

No owner-approved target pH/context or explicit residue microstate list is present. Receptor acidic/basic side chains, histidines, termini, and any coupled local network remain unresolved for an exact PreparedReceptorState. The two source disulfides are explicit and should be retained, but no hydrogen model is derived from them here. Histidine tautomers/protonation, terminal charges, hydrogen positions, hydroxyl/thiol orientations and Asn/Gln/His flips have not been assigned.

PHD-V2-03/15 place automatic receptor pKa/protonation outside ordinary explicit-state V1; PHD-V2-04/15 likewise exclude automatic ligand protonation, tautomer, conformer/minimization, and implicit rotor/root generation. Source pH cannot stand in for these choices.

## Typing, scoring, and component capability

The exact RTL CCD heavy-atom graph has complete current CORE_DRY_V1 XS type coverage (C_H ×19, C_P ×1, O_DA ×1). The canonical V1 scorer does not consume atom partial charges; formal charge is part of ChemicalState and remains zero for the source CCD ligand. No receptor/ligand docking representation, partial-charge file, or PDBQT has been made.

The water environment fits only the named dry policy: 35 waters remain in source evidence; one is within 5 Å and two within 8 Å of any RTL heavy atom; no direct ligand contact or ligand–protein bridge was found. A water near C18 is also near protein polar atoms, so omission is a profile-limited approximation to disclose, not proof that all solvent is irrelevant. No metals, ions, cofactors, or unusual components are present.

## Incomplete receptor graph at the pocket

The source audit identifies absent sidechain heavy atoms in ASP101, LEU103, ASN104 and GLU105 (natural precursor numbering), whose nearest observed residue atoms are 6.3939, 3.6203, 3.9869 and 6.5587 Å from RTL. The missing coordinates are unknown; residue-atom minima are only evidence that these incomplete residues sit near the pocket/scoring environment. Under PHD-V2-03 REC-D06, exact preparation must block or use a separately validated repair profile with explicit authorization. There is no approved repair profile, and rebuilding these atoms would be a heavy-atom transformation. The absent Leu17 continuation creates a separate terminal-topology problem.
## Exact preparation toolchain status

**None is approved.** The current SOT says no preparation profile is approved and Meeko v0.8.0 is reference evidence only. D2's named receptor/ligand profile IDs and sealers accept already-resolved states; they do not specify the executable process that derives residue chemistry, handles missing Leu17, places/optimizes hydrogen coordinates, creates an explicit ligand kinematic tree, or validates immutable heavy atoms. No exact package hash, dependencies, environment digest, command, options, warning policy, or output hash-validation procedure is approved. Preparing with arbitrary Reduce, PDBFixer, Open Babel, RDKit, or Meeko defaults would violate the no-hidden-choice rule.

## Future-search-region status

The source ligand envelope is frozen as evidence only: x [3.36420, 14.40788], y [-3.63735, 6.26794], z [-1.09950, 4.51020] Å. No SearchRegion ID/digest, center/size, or search policy is authorized. Do not use the validation padding value as an implicit docking box.

## Human computational-chemist questions before any future authorization

1. Approve or reject the explicit neutral all-trans RTL chemical state and its atom-to-CCD/source mapping; confirm the four E/Z descriptors are preserved.
2. Define the exact permitted hydrogen addition/orientation/optimization process without moving source heavy atoms, including the malformed/incomplete N-terminal peptide issue at Ile18.
3. Specify the owner-approved pH/context and residue-level receptor microstates, especially all histidines and terminus handling; distinguish source-condition evidence from modeled-state choice.
4. Confirm the chemistry-based kinematic model, root/tree, exact search_torsion_count, and separate PHD-V2-06 N_tors_vina treatment under a fully identified profile. The current one-torsion count is an unsigned Codex graph inference only.
5. Name a reproducible profile and toolchain with exact package/executable and dependency hashes, environment/container digest, invocation/configuration, permitted/prohibited transformations, deterministic/error semantics, and validation/provenance outputs. No such toolchain is presently approved.
6. Confirm that the dry-water policy is appropriate for the development claim and does not erase a required ligand-mediated water interaction.

**Reviewer disposition:** NOT PROVIDED. No human approval is claimed.