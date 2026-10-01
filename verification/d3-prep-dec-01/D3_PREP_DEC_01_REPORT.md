# D3-PREP-DEC-01 — 181L/BNZ preparation authorization and scientific review gate

**Classification: D3-PREP-DEC-01 HOLD — 181L/BNZ NOT SCIENTIFICALLY ADMISSIBLE**

## Scope and result

This lane freezes source evidence and prepares owner and independent-review decisions for one possible development-only, frozen crystal-pose scoring case. It does not authorize or perform molecular preparation. No hydrogens were added, no molecular coordinates or atom identities were changed, no PDBQT or prepared state was produced, and no direct/grid pose comparison, tolerance selection, or D4 work was performed.

The digital source is reproducibly identified as the current deposited 181L mmCIF. The exact experimental construct/sample identity remains unresolved: the current deposition records substitutions T54, A97, and A99 relative to UniProt P00720, while its summary metadata says “Mutation(s): No”; literature supports an L99A cavity mutant and later work describes a C54T/C97A background, but no original 181L clone or sample-lot record was recovered. The source sequence contains ASN163 and LEU164, but the deposited model has coordinates only through Lys162. Neither the physical terminal state nor the meaning of the modeled terminus is established for the sample.

Bulk mother-liquor pH 6.7 is documented, but it does not establish crystal-internal pH or residue microstates. Receptor protonation, histidine states, hydrogen orientation, retained components, preparation software, exact settings, and a reproducible environment have not been approved. The evidence is insufficient to authorize a preparation run.

## Gate effects

- D3-PREP-EXEC-01: NOT AUTHORIZED.
- Full D3: HOLD.
- D4: BLOCKED.
- DOCKING.RUN: UNAVAILABLE.

No human owner approval or independent scientific sign-off is asserted. The decision register and review packages identify the open decisions and ask the required questions without assigning reviewers or fabricating approvals.

## State and provenance summary

- Base: ab948400dae6a57804187338fd616657c9dc8856, the D3-FP-01 closure commit whose first parent is 24c2bf28b811af21c22693091f80f2e47e84fc80.
- Branch: research/d3-prep-dec-01-181l-bnz.
- Worktree: C:\Users\mukun\.codex\worktrees\d3-prep-dec-01-181l-bnz\molecular-workstation.
- Frozen source: source_artifacts/181L_current.cif; 195,587 bytes; SHA-256 7ef097473b7f0c906f10e4016e4b6e5973abf4e47bf910699912913404dbb671. It is byte-identical to both Drive retrievals listed in 181L_SOURCE_IDENTITY_FREEZE.md.
- Candidate receptor: deposited 181L, entity 1, author/asym protein chain A, model 1 in the source file. Assembly 1 is described as monomeric, while the assembly generator lists asym IDs A–F; component policy requires an explicit decision.
- Candidate ligand: deposited BNZ, entity 4, asym E, author chain A, author residue 400; six observed heavy atoms C1–C6 and one coordinate model.
- Construct: physical sample genotype unresolved; deposited sequence differences are evidence, not proof of the original sample vial.
- Termini: sequence includes ASN163/LEU164; their coordinates are absent. No reconstruction or terminal-charge choice is authorized.
- pH: pH 6.7 is the reported bulk crystallization condition only; protonation remains undecided.
- Methods and toolchain: none selected or authorized. Candidate package versions and hashes are recorded as non-authoritative evidence in TOOLCHAIN_LOCK_PROPOSAL.md.
- Changed paths: see CHANGED_PATHS.txt. All authored files are confined to verification/d3-prep-dec-01/**.

## Required evidence and open actions

The exact source, construct distinction, terminal decision, receptor/ligand chemical-state policies, component policy, future state contract, search-region limits, cohort governance, owner decisions, reviewer questions, and execution handoff are captured in the accompanying files. Every substantive chemistry choice is pending owner decision and independent review. OPEN_BLOCKERS.md is the finite stop list.

The next permitted action is owner and independent scientific review of the packages. If construct/sample identity or terminal chemistry remains unresolved, this candidate stays on HOLD; preparation cannot be authorized by this package. This package contains no D3_PREP_EXEC_01_PROMPT.md because the source evidence does not meet the brief's sufficiency condition for an execution prompt.