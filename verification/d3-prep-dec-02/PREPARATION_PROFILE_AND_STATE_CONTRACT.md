# Preparation profile and prepared-state contract disposition

## Profile status

**No 3ATL/BEN preparation profile is proposed or approved. No preparer is selected.**

The candidate fails the already approved water boundary: its ligand-recognition environment contains a literature-supported W1 bridge and Asp189-side water reservoir, while CORE_DRY_V1 has no explicit scoring water and no approved fixed-water extension. An execution tool cannot resolve this scientific mismatch.

The current D3-DEC-02 owner decision identifies Meeko 0.8.0 as experimental/reference evidence only, not the Mole Explorer production preparer. PHD-V2-15 classifies automatic pKa/protonation/tautomer/conformer/minimization choices as experimental/unvalidated unless a later explicit profile validates them. PDB2PQR, PROPKA, defaults from any other package, and unpinned downloads do not become authorized by mention in prior research.

Therefore there is no exact program/version, immutable release or commit, executable/container hash, environment digest, command line, settings profile, warning policy, output contract, or deterministic provenance record that may be truthfully frozen for this candidate.

## Required conditions for any later preparation gate

If a different candidate is selected and its chemistry is admissible, the later gate must explicitly freeze, before execution:

1. Exact source artifact digests, entry/model/assembly/chain/altloc policy, source atom identifiers, and sequence/construct identity.
2. Receptor and ligand ChemicalState identities, including pH authority, protomer/tautomer/resonance choices, termini, disulfides, and all included-component roles.
3. Explicit hydrogen-generation/orientation policy and atom mapping, without any silent side-chain flip or heavy-atom movement.
4. Tool name, exact version/source commit, binary or environment digest, platform, dependencies, deterministic options, input digest, output digest, and warning/error handling.
5. Heavy-atom identity and coordinate invariance checks, plus explicit classification of any separately approved transformation.
6. PreparedReceptorState and PreparedLigandState serialization, component policy, atom typing, provenance lineage, canonical digest algorithm/profile, and failed-state codes.
7. LigandKinematicModel and distinct scorer N_tors evidence under the exact supported D3 Vina semantics.
8. SearchRegion source, bounds, profile and digest after both molecular states are fixed.
9. Confirmation that direct and grid paths consume identical prepared-state digests and coordinate geometry.
10. Dated, evidence-linked structural-biology review, computational-chemistry review, and accountable owner decision before execution authorization.

No values are filled in for 3ATL because the candidate is rejected. This list is a stop checklist, not a recipe.

## Expected scientific state objects if a future candidate passes

### Receptor lineage

The applicable PHD-V2 contracts require a linked, immutable chain containing ReceptorIdentity; ExperimentalStructureState; explicit ReceptorChemicalState; CoordinateState; component roles and inclusion/exclusion provenance; PreparedReceptorState; typing assignment/profile; preparation profile identity; source hashes; and canonical scientific digests.

### Ligand lineage

The applicable contracts require MolecularIdentity and exact graph; explicit ChemicalState; immutable source-derived CoordinateState; source atom-UID correspondence; explicit hydrogens and stereochemistry if present; PreparedLigandState; supported typing; LigandKinematicModel; preparation profile identity; source hashes; and canonical scientific digests.

### Shared experiment state

The future experiment must seal SearchRegion, scoring/typing/numerical/grid profiles, source artifact hashes, and exact receptor/ligand state digests. Direct and grid scoring must consume the identical frozen scientific states and geometry. A raw mmCIF, a prepared-looking PDB/PDBQT, or a tool's output file alone is not a PreparedReceptorState or PreparedLigandState.

These field families follow [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit), [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit), [PHD-V2-05](https://docs.google.com/document/d/1LEjVH3QmEWlzRzt_xAX-rZPVBTBP1tsIhOUyX-fPeck/edit), [PHD-V2-06](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit), and [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit).

## Gate effect

No output state exists, no SearchRegion digest exists, and no future execution prompt is generated. A new candidate-selection decision is required before another preparation-authorization gate.
