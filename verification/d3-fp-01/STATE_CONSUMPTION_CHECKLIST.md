# State-consumption checklist

A full-pose fixture must freeze one receptor state, one ligand state, and one shared experiment definition. Direct and grid scoring must receive the same molecular coordinates and scientific state digests. All rows below are required; none can be inferred from a raw structure or scorer input.

| Layer | Required frozen value or evidence | Status for every inspected candidate |
|---|---|---|
| Receptor identity | Exact source entry and hash, assembly, model, chain/entity mapping, construct/mutations, stable atom/residue mapping | Missing as sealed identity |
| Receptor chemical state | Explicit protonation/pH authority, histidine and termini states, disulfides, component roles, water/ion/metal/cofactor inclusion/exclusion | Missing; choices unresolved |
| Receptor coordinate state | Exact coordinates and altloc policy, missing residue/atom policy, hydrogen generation/orientation, heavy-atom immutability check | Missing; candidate-specific gaps listed in eligibility matrix |
| Prepared receptor | D2 schema/object, profile ID/version/digest, supported chemistry and XS typing assignments, validation result, provenance digest, canonical scientific digest | Missing |
| Ligand identity and chemistry | Exact ligand component, source mapping, connectivity, formal charge, bond orders, stereochemistry, tautomer/protomer authority | Missing as sealed state; candidate-specific questions remain |
| Ligand coordinates | Exact finite 3D coordinates, atom identity mapping, heavy-atom immutability and coordinate-state digest | Missing |
| Prepared ligand | D2 schema/object, typing assignments, kinematic/search torsion model, preparation profile/digest, provenance and canonical digest | Missing |
| Vina scorer torsions | Pinned scorer-specific N_tors value and atom/bond evidence, distinct from source TORSDOF and search torsion model | Missing |
| SearchRegion | Exact receiver-frame closed AABB, extrema, derivation and provenance, SearchRegion digest | Missing |
| Scoring and typing | Current scoring and typing profile IDs/versions/digests, supported chemistry evidence | No fixture-bound values |
| Grid | Current grid profile and domain evidence bound to the same receptor/ligand/region/profile inputs | No fixture-bound values |
| Numeric backend | Exact canonical numeric backend profile ID/version/digest and arithmetic/resource settings | No fixture-bound values |
| Shared experiment | Immutable tuple of receptor, ligand, SearchRegion, scoring, search, numeric, resource/RNG/result digests | Missing |
| Direct consumer | Read-only loadability evidence showing direct path consumes the frozen pair and identical experiment tuple | Not performed; no state pair |
| Grid consumer | Read-only loadability evidence showing grid path consumes identical geometry and tuple | Not performed; no state pair |
| Cohort and blinding | Development versus confirmatory assignment with outcomes protected as required | No fixture admitted; no cohort |
| Freeze and revalidation | Content-addressed artifacts, complete source-to-state hashes, deterministic load check, no mutation | No artifacts to freeze |

## Current profile baseline

The repository names these current profile identifiers: scoring ME_DOCKING_V1_VINA_CLASSIC_1_0, typing ME_XS_TYPING_V1_1_0, supported chemistry ME_SUPPORTED_CHEMISTRY_V1_1_0, numeric backend ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0, and canonical serialization ME_CANONICAL_CBOR_V1_1_0. The D3 Vina torsion interpretation profile is ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1. D2 also names receptor and ligand profile identifiers ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0 and ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0. These identifiers define contract inputs; by themselves they are not an approved candidate preparation toolchain, candidate-bound profile digests, or prepared states. No candidate has the exact profile digest tuple required for admission.

## Contract references
D2 state structures are defined in ../../packages/contracts/src/docking/d2.ts. Receptor preparation requirements are in [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit); ligand states and torsion semantics in [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit); exact SearchRegion in [PHD-V2-05](https://docs.google.com/document/d/1LEjVH3QmEWlzRzt_xAX-rZPVBTBP1tsIhOUyX-fPeck/edit); chemistry/typing/scoring in [PHD-V2-06](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit); provenance and digests in [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit); numeric boundaries in [PHD-V2-13](https://docs.google.com/document/d/1SZcS9UDGi-Ffa_WeOdWhrgdUaItHGxSRBzc271HF6OU/edit); final synthesis in [PHD-V2-15](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNVuTVuTZmiMicjHIVEfmpM/edit).

The controlling current scoring-field architecture is 16 XS types / 80 logical channels / conditional 59 physical arrays. Grid architecture approval does not supply fixture-bound state or profile digests.
