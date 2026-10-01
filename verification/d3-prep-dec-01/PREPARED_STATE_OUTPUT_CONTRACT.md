# Prepared-state output contract proposal

This document describes the minimum future evidence objects. It is not a generated state or an approval to generate one.

## Receptor side

A future receptor state must bind:
- ReceptorIdentity: exact accepted entity, construct/sequence, chain/asym mapping, assembly, model, source artifact digest, and atom/residue identity map;
- CoordinateState: exact accepted source coordinate set, model and component scope, and canonical digest;
- ChemicalState: explicit residue protonation/tautomer and terminal assignments, formal charges, added-atom identity and parent mapping, pH authority, method/settings and reviewer evidence;
- preparation profile ID/version/digest and complete tool/environment lock;
- component inclusion/exclusion list with per-component rationale;
- supported atom typing profile and explicit per-atom XS typing assignments;
- source-to-derived provenance chain and canonical scientific digest.

## Ligand side

A future ligand state must bind:
- exact benzene chemical graph, formal charge, stable atom UIDs, source C1–C6 mapping and source artifact digest;
- exact observed coordinate state and coordinate digest;
- explicit hydrogen derivation and parent mapping if required;
- preparation profile and tool lock;
- atom typing assignments;
- search torsion model, serialized representation conventions, and scorer N_tors as separate fields;
- provenance chain and canonical scientific digest.

## Shared experiment state and invariants

- Exact scoring profile, typing profile, numerical backend profile, and grid profile, each with version and digest.
- Exact SearchRegion with closed bounds, coordinate frame, derivation, interpolation halo and canonical digest.
- The same immutable receptor and ligand scientific states and coordinates must feed direct and grid pathways.
- Byte-level source and output hashes, canonical scientific digests, and an audit trail must be retained.
- Any output missing an essential field is rejected; no default or reconstruction fills missing scientific state.
- Heavy-atom identities and coordinates must match the reviewed source state exactly unless an explicitly approved transformation defines another CoordinateState.

Expected conceptual objects are PreparedReceptorState, PreparedLigandState, and SearchRegion under the applicable D2/PHD-V2 contracts. This lane creates none of them. DEC-11 and DEC-12 are pending owner and reviewer decisions.