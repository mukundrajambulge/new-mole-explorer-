# Minimum authorization package for one development fixture

## Candidate submitted for a decision
Use the existing D3-VAL-01 proposal as the review subject; this lane does not approve it.

- Candidate: 181L / benzene (BNZ).
- Source artifact: mmCIF, reported SHA-256 7ef097473b7f0c906f10e4016e4b6e5973abf4e47bf910699912913404dbb671.
- Candidate ligand identity in source audit: BNZ entity 4, asym ID E, author chain A, residue 400.
- Receptor identity reported by source audit: model 1, author assembly 1 monomer, protein entity 1 / chain A.
- Audit coverage: 162 of 164 protein residues modeled; ASN163 and LEU164 are absent.
- Construct question: T54/A97/A99 source observations versus the L99A construct annotation remain unresolved.
- Reported crystallization/mother-liquor pH 6.7 is evidence about the experiment, not authorization of a receptor or ligand protonation state.
- D3-VAL-01 calls 181L/BNZ the proposed primary. D3-RA-01 still says not prepared and not eligible.

These details come from the D3-VAL inventory, audit and owner decision in the [D3-VAL-01 folder](https://drive.google.com/drive/folders/1KVXKzwacjAjQSJri2VzP7byXpNt8F08H), together with the [D3-RA-01 evidence folder](https://drive.google.com/drive/folders/18a3MguBMgcnYVfMTBdgHQ9XxetQHfinQ). Approval or rejection must be recorded by the responsible owner before preparation.

## Required decisions before any preparation
The owner and reviewers must resolve, with explicit evidence and named authority:

1. Candidate approval or rejection for a single development fixture; do not assign confirmatory status here.
2. Exact receptor source, biological assembly, model, chain/entity mapping, construct and mutation identity, including T54/A97/A99 versus L99A.
3. Treatment of missing ASN163 and LEU164 and any other site-relevant missing atoms/residues. Record an evidence-based keep/exclude/repair decision; do not silently model missing coordinates.
4. pH authority and exact receptor chemical state: termini, each histidine, disulfides, titratable side chains, and other relevant protonation states.
5. Hydrogen addition and orientation method and settings, with a rule that specified heavy-atom coordinates remain byte/value- or digest-identical unless a separately authorized transformation explicitly permits changes.
6. Water, ion, HED, and other nonpolymer/component role policy. The audit reports no water/nonpolymer within 8 Å, but 136 global waters, HED, and two chloride components exist; the policy must be explicit and provenance-bearing.
7. Exact BNZ component, atom mapping, bond orders, formal charge, stereochemical and coordinate source, explicit ligand chemical state, and frozen coordinate state.
8. Supported chemistry and atom typing under the current approved scoring/typing profiles.
9. A frozen SearchRegion derived in the selected receptor coordinate frame, with exact bounds and provenance.
10. A single development cohort assignment and outcome-handling rule.

## Tool and profile lock required before running tools
D3-RA-01 contains tool research and synthetic checks, not an approved molecular-preparation toolchain. It mentions candidate versions PDB2PQR 3.7.1, PROPKA 3.5.1, and RDKit 2026.03.6. The report records platform-specific package artifact hashes: PDB2PQR wheel 15f7422a41ea4c789e564e2ef00ac10b8f020b589b650f6225e627a5901305ea; PROPKA package 2df2d81adc9205113a0e6f9d96b06b46e29716bc3a712075dd396e0eefdfc3; RDKit CPython 3.12 manylinux x86_64 wheel 9f97b58f1962df73bdacf44347bfa013f4fcb9896e049f98af2183e70e7aab46. These are reported evidence hashes for research artifacts, not an approved lockfile, supported deployment platform, or authorization to use these tools.

Before preparation, the approved package must name each exact tool and version, artifact hash, platform/container digest, invocation, all settings, profile identifiers and versions, deterministic behavior and warnings. PDB2PQR documented defaults include pH 7.0 and automatic debump/H optimization; the documented noopt route still permits water-only optimization. None of those defaults or options is adopted here. PROPKA output may inform a reviewed decision only if the owner/reviewer authorizes its role. No preparation tool or profile is selected by this report.

## Required output objects and provenance
The approved preparation work must produce, without placeholder values:
- source artifact record and SHA-256;
- exact ReceptorIdentity and parent mapping;
- explicit receptor ChemicalState and CoordinateState;
- explicit ligand identity, ChemicalState, CoordinateState, stable source-to-atom mapping, and kinematic model;
- PreparedReceptorState and PreparedLigandState under the D2 schema, with profile ID/version/digest, supported chemistry and typing, validation, warnings/blockers, provenance digest, and canonical scientific digest;
- exact SearchRegion and digest in the receptor frame;
- fixture-bound scoring, typing, grid, numeric, resource, search and result profile identities/digests;
- a provenance manifest linking all source artifacts, tool artifacts, settings, outputs, and state digests.

See the [D2 state contract](../../packages/contracts/src/docking/d2.ts), [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit), [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit), [PHD-V2-05](https://docs.google.com/document/d/1LEjVH3QmEWlzRzt_xAX-rZPVBTBP1tsIhOUyX-fPeck/edit), [PHD-V2-06](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit), [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit), and [PHD-V2-15](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNVuTVuTZmiMicjHIVEfmpM/edit).

## Review, approvals, and fail-closed conditions
Before preparation, require recorded approval from the responsible project/fixture owner and independent review by a qualified structural biologist and computational chemist/molecular-preparation reviewer. Review must cover the exact source, construct, missingness, receptor/ligand states, components, heavy-atom invariance, tool lock, profile, supported chemistry, provenance and validation plan.

Stop and return to the owner if the source hash changes, construct or component identity is unresolved, state alternatives remain ambiguous, required chemistry is unsupported, a tool changes protected heavy-atom coordinates, a required state/digest cannot be produced, the provenance chain is incomplete, or reviewer/owner decisions disagree. Do not repair or select a state by engineering preference.

## Work permitted after authorization
After approvals and a locked plan are recorded, a separately scoped preparation task may produce one development fixture and its immutable state/provenance objects. That task must then verify read-only loadability through both direct and grid pathways using the same state tuple. It does not set an approximation PASS threshold, accept Full D3, begin D4, or enable DOCKING.RUN.
