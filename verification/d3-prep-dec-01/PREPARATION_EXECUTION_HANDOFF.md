# Preparation execution handoff

## Current state

D3-PREP-DEC-01 is HOLD — 181L/BNZ NOT SCIENTIFICALLY ADMISSIBLE. No molecular preparation has been performed. D3-PREP-EXEC-01 is NOT AUTHORIZED. There is no execution prompt in this lane because exact source evidence is insufficient to define the physical construct and terminal chemical state.

## Smallest next integration step

Obtain owner and independent reviewer dispositions for DEC-02 and DEC-04 first. These two decisions determine whether the candidate has a defensible receptor identity and terminal connectivity. If either remains unresolved, close the review with a continued scientific HOLD and do not begin preparation.

If the owner accepts a digital deposited-model case despite missing physical sample identity, record that exact limitation and confirm it is admissible for the development-only purpose. Then complete the remaining decisions in OWNER_DECISION_REGISTER.md and review packages. Resolve receptor states, component scope, BNZ representation, hydrogen generation, toolchain lock, immutable output contract, and SearchRegion policy before requesting a separate execution authorization.

## Future execution gate

A separate D3-PREP-EXEC-01 request must not be issued until:
1. The exact receptor identity, construct/terminal interpretation, assembly/model, and component dispositions are explicit.
2. Owner decisions and independent structural-biologist and computational-chemist reviews are recorded with identity, date, evidence, rationale, and any dissent.
3. Receptor and ligand ChemicalState policies are fixed, including histidines, termini, hydrogens, BNZ atom mapping, charge, and torsion semantics.
4. Exact preparation software, versions, package hashes, immutable container/platform digest, dependency lock, invocations, and settings are reproducible.
5. A fail-closed D2 output contract and canonical digest procedure are accepted.
6. A defined SearchRegion and grid/interpolation contract are frozen for the later comparison.
7. Heavy-atom immutability checks and complete provenance requirements are explicit.
8. The owner gives a new explicit authorization to execute that defined preparation procedure.

During any later execution, stop on any unexpected heavy-atom change, unmapped atom, missing state field, tool/version drift, non-reproducible output, chemistry outside the approved profile, unresolved component/terminal case, or digest mismatch. Preserve every failed output as non-authoritative evidence and do not repair it silently.

## Gate status

This handoff is not authorization. Full D3 remains HOLD; D4 is BLOCKED; DOCKING.RUN is UNAVAILABLE.