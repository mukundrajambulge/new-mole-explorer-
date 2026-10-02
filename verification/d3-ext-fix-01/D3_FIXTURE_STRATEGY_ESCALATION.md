# D3 fixture strategy escalation

## Decision state

D3-EXT-FIX-01 identified a promising external lead but no CORE_DRY_V1-admissible fixture. This record preserves the next strategic choices for a future owner/reviewer decision. It does not select a strategy, authorize a profile expansion or start another gate.

4W52/BNZ is the strongest current lead because its neutral benzene graph is simple, its audited ligand shell has no water within 5 Å and no nearby metal, and a geometry-only field estimate fits current resource limits. The official UniProt P00720 reference is 164 residues; deposited mmCIF maps R12G and I137R as variants, L99A as engineered, and LEHHHHHH at positions 165–172 as expression tag. Primary construct records still need to resolve sample provenance for the two variants and whether the unmodeled tag was removed before crystallization. The authorization barrier remains open.

The prior 181L/BNZ rejection for construct/terminal ambiguity and 3ATL/BEN rejection for its relevant binding-site water network remain unchanged. CORE_DRY_V1 is not weakened in this lane.

## Possible future strategies

| Strategy | Required decision and evidence | Scope boundary |
|---|---|---|
| 1. Resolve and continue external candidate search | Retrieve 4W52 construct/purification records and mutation reconciliation; if they fail to close, broaden the RCSB/primary-source search with the same hard criteria and raw-source audit. | Candidate discovery and source triage only until a separate candidate authorization gate. |
| 2. Develop a purpose-built scientific micro-fixture | Define an experimentally derived simple system, source and construct, ligand graph/state, local environment, preparation profile, review owners and acceptance purpose. | Requires a distinct scientific design and approvals; cannot silently substitute an engineered or synthetic coordinate model. |
| 3. Research fixed structural-water support | Establish a scientific model for water identity/retention, scoring representation, provenance, sensitivity and independent validation. | New scorer-domain and scientific authorization program; no implementation is authorized here. |
| 4. Research additional supported chemistry | Identify the exact chemistry need, define evidence-backed atom typing/scoring semantics and validation cohort. | Requires new scientific authorization; do not add a type or term within this lane. |
| 5. Reconsider full-pose validation design | Review whether the current D3 question can be tested with another scientifically justified validation design and preserve direct/grid state identity. | Requires contract-level review; does not turn a raw structure into a prepared state or accept D3. |

## Owner and independent review needed

An owner must select which research path to pursue and confirm the intended fixture purpose. Any resulting candidate requires independent structural-biology and computational-chemistry review, explicit state and provenance, and a separate authorization gate. A scorer-domain expansion additionally requires a scientific authorization program. Full D3 remains HOLD, D4 remains BLOCKED and DOCKING.RUN remains unavailable.
