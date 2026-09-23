# D1 Scope and Negative Audit

## Production surface

The only D1 docking production files are the contract/serialization modules:

- `apps/api/src/docking/scientificSerialization.ts`
- `packages/contracts/src/docking/{architecture,canonical,domain,identity,index,profiles,requests,status}.ts`

The remaining D1 files are the requirement matrix and tests. No docking engine,
preparation service, scoring service, search service, GPU kernel, or HTS worker
was added.

## Explicitly absent / not implemented

- automatic receptor preparation: absent
- automatic ligand preparation: absent
- protonation generation: absent
- tautomer enumeration: absent
- stereoisomer enumeration: absent
- conformer generation: absent
- rotor generation: absent
- scoring: absent
- search: absent
- optimization: absent
- RMSD engine: absent from D1
- clustering engine: absent from D1
- GPU docking: absent
- HTS: absent
- fake or random docking scores: absent
- D2 production code: absent

## Fail-closed evidence

`DOCKING.RUN` and the other future docking/HTS command names appear only as
reserved metadata with `capabilityState: UNAVAILABLE` and `executable: false`.
`resolveCommand("docking.run")` returns `UNKNOWN_COMMAND`, and dispatching
`docking.run` returns `FAILED` without creating a job. These invariants are
asserted by `apps/api/src/docking/d1Contracts.test.ts` and
`apps/api/src/command/registry.test.ts`.

PDBQT is represented only by `PdbqtExecutionRepresentationRef` with
`authoritativeForMolecularIdentity: false`; it cannot become molecular
identity authority.

## Diff boundary

The sealed-baseline diff has 14 changed source/test files, all within the
authorized D1 contract, serialization, status, command-registry, and fail-closed
test surfaces. No frozen upstream implementation file changed.
