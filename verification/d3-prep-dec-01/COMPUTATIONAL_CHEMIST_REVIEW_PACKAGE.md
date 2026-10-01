# Computational chemist review package

## Review status

Reviewer: not assigned in the available evidence.
Review status: PENDING. No toolchain or method approval is claimed.

Review the state and tool proposals in RECEPTOR_CHEMICAL_STATE_POLICY.md, HYDROGEN_POLICY.md, COMPONENT_RETENTION_POLICY.md, BNZ_CHEMICAL_STATE_POLICY.md, TOOLCHAIN_LOCK_PROPOSAL.md, PREPARED_STATE_OUTPUT_CONTRACT.md, and SEARCH_REGION_FIXTURE_POLICY.md.

## Questions requiring a documented answer

1. Given an owner-approved exact receptor identity and pH authority, what defensible residue-level protonation and tautomer method is appropriate? What alternatives or uncertainties need to be preserved?
2. How should histidine protonation and tautomer state be assigned and reviewed in the local environment? Which residues are material to this site?
3. What hydrogen generation and orientation policy is deterministic and chemically consistent with the approved state, including termini and any hydroxyl groups?
4. Can a candidate preparation tool satisfy the strict heavy-atom immutability requirement? Demonstrate exact atom identity and coordinate preservation with an approved reproducible environment before any molecular operation is authorized.
5. What exact disposition should apply to waters, HED, chloride, assembly asym IDs, and any other source components for this one dry scoring case? What interpretation does that support?
6. Does the source BNZ graph, atom map C1–C6, neutral charge, and zero chemical rotors match the intended pinned chemical representation? Resolve the separate search-torsion, PDBQT serialization, and scorer N_tors semantics under the current controlling contracts.
7. What complete OCI digest, platform, runtime, dependency lock, package/executable hashes, command options, profile IDs, and output digest rules are necessary for reproduction?
8. What exact D2 PreparedReceptorState, PreparedLigandState, ChemicalState, CoordinateState, and shared SearchRegion fields and canonical digests are required under the current contracts?
9. What finite closed SearchRegion and interpolation halo satisfy the frozen-pose scoring design and D3-GRID-01 domain requirements after state admission? Do not choose bounds to tune an observed score agreement.
10. Are direct and grid pathways demonstrably consuming identical immutable states and coordinate digests? What read-only evidence is required to show this without running a score comparison at this gate?
11. Is this suitable only as a development fixture, and are all confirmatory, holdout, accuracy, affinity, and pass-threshold claims excluded?

## Required record

Record reviewer identity/role, date, exact software and contract versions reviewed, answers with cited evidence, dissent, and approval or explicit hold. Tool hashes or synthetic fixture behavior alone do not establish a production method. A material unanswered question leaves preparation unauthorized.