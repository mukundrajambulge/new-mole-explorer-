# Open blockers

## Selection blockers

1. **No candidate currently meets CORE_DRY_V1_ADMISSIBLE.** No D3-PREP-DEC-03 candidate-specific authorization prompt is generated.
2. **4W52 / BNZ is the strongest lead but construct source resolution is missing.** Its mmCIF maps R12G and I137R as variants, L99A as engineered, and LEHHHHHH as expression tag. The exact sample provenance for the two variants and physical C-terminal tag cleavage are unresolved. The receptor terminal chemistry cannot be assigned safely from the current evidence.
3. **Other candidates have hard local blockers.** See CANDIDATE_SELECTION_DECISION.md and the six comparative matrices: incomplete receptor/alternate states, unresolved ligand microstates, unsupported receptor/co-ligand chemistry, water-dependent recognition, or a crowded ambiguous component environment.

## Preparation and validation remain out of scope

- No preparation profile or toolchain is approved by this lane.
- No ChemicalState, PreparedReceptorState, PreparedLigandState, atom typing, torsion model, SearchRegion or canonical scientific digest was created.
- No water, metal, sulfate, buffer or cofactor policy was authorized.
- No molecular preparation, coordinate modification, direct/grid experiment, docking or production change occurred.

## Smallest next integration step

Obtain primary construct and sequence records for 4W52 that resolve (a) the sample provenance of reference differences R12G and I137R alongside engineered L99A and (b) whether residues LEHHHHHH were cleaved before crystallization. The retained official UniProt P00720 record gives a 164-residue T4 lysozyme reference; the deposited 172-position polymer maps residues 165–172 as an expression tag. If primary records provide a single unambiguous receptor construct/terminal state, start a separate D3-PREP-DEC-03 authorization review of 4W52, including receptor chemical state, component policy, atom typing, heavy-atom invariance and independent review. If they do not, use D3_FIXTURE_STRATEGY_ESCALATION.md to choose the next research direction without selecting by engineering convenience.

No approval or owner decision is implied by this blocker list.
