# Open blockers

## Scientific admission blockers

1. **Experimental construct identity unresolved.** Detailed 181L mmCIF annotations show T54/A97/A99, the public summary says “Mutation(s): No,” and literature context does not prove the 181L sample clone or lot. Owner and structural-biologist decision required. Evidence: 181L_CONSTRUCT_DECISION.md and the frozen source.
2. **Terminal state unresolved.** ASN163/LEU164 are present in sequence but absent from coordinates; evidence does not establish whether they were present in the physical construct. Lys162 cannot be assigned a biological terminal state by assumption. Evidence: 181L_TERMINAL_STATE_DECISION.md.
3. **Assembly/component scope unresolved.** The record describes assembly 1 as monomeric but lists A–F in its assembly generator. Waters, HED and chlorides lack an approved inclusion policy. Evidence: COMPONENT_RETENTION_POLICY.md.
4. **Receptor chemical state unresolved.** pH 6.7 is bulk mother-liquor pH only. No pH authority, residue-level protonation, histidine state, or terminal assignment is approved.
5. **Hydrogen policy unresolved.** No generation/orientation method or deterministic mapping is approved; strict heavy-atom immutability is not demonstrated for a selected tool.
6. **Toolchain not locked.** Candidate software artifacts and hashes are not a full exact environment, invocation, or reviewed profile. No preparation tool has been selected.
7. **Ligand representation policy pending.** BNZ chemical identity is strongly constrained, but the exact pinned representation and separation of search torsion, PDBQT serialization and scorer N_tors must be checked under controlling contracts.
8. **D2 prepared states absent.** No PreparedReceptorState or PreparedLigandState was produced or sealed. Raw mmCIF and the ligand's experimental coordinates are source evidence only.
9. **Owner and independent scientific sign-offs absent.** Required reviewers are not named in the available evidence; no approval is fabricated.
10. **SearchRegion not frozen.** A future finite region and interpolation halo depend on admitted states and resolved grid profile; no numeric bounds or digest are established.

## Stop condition

Any unresolved essential receptor identity, construct, terminal, chemical state, provenance, or reproducibility field prevents preparation authorization. No blocker was bypassed by a default. D3-PREP-EXEC-01 remains NOT AUTHORIZED.