# Preparation toolchain disposition

## Decision

No exact preparation toolchain or executable profile is approved. Preparation execution is not authorized.

This is a material reproducibility blocker under the candidate-specific D3-PREP-DEC-03 prompt. CORE_DRY_V1 ligand atom-type coverage does not constitute an approved receptor/ligand preparation implementation.

## Evidence

- The current canonical Source of Truth says no preparation profile is approved.
- Meeko 0.8.0 remains reference evidence only.
- Automatic pKa/protonation, tautomer selection, conformer generation/minimization, and kinematic/root generation remain experimental or unvalidated.
- D2 PreparedReceptorStateV1 and PreparedLigandState sealing contracts consume already-resolved explicit objects; they do not specify the external preparation process.
- D2 receptor sealing requires graph atoms to have coordinates, rejects unresolved chemical states, and rejects fixed/mobile water roles under the current dry profile. It does not define reconstruction, termini, protonation, hydrogen placement, or a future search region.
- No approved executable/package hash, dependency lock, environment/container digest, exact invocation/options, allowed transformation list, deterministic behavior contract, warning/error policy, output validation, or provenance bundle has been selected for this source.

## Consequence

Do not invoke Meeko, Reduce, PDBFixer, Open Babel, RDKit preparation defaults, or any other preparation program for this gate. No receptor/ligand hydrogens, chemical microstates, reconstructed heavy atoms, PDB/PDBQT, prepared-state digests, or SearchRegion were produced.

A future preparation authorization requires the owners and qualified reviewers to resolve the source-state blockers and approve a reproducible profile with the fields above. That future review must still preserve immutable source evidence and explicitly account for the missing mature Leu17, pocket-sidechain atoms, natural variants, waters, and receptor chemical state. This disposition does not authorize that work.
