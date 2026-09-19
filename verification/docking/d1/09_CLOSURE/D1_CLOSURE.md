# Mole Explorer Docking D1 Closure

## Acceptance

- Sealed baseline: `28a8dca64a4711ca4b9e00e13e19601e56404709`
- Accepted repaired SHA: `26227a10416657d0c2518bd0b751a38693627d5b`
- Accepted tag: `mole-explorer-docking-d1-accepted-2026-09-19`
- Hosted CI: [run 35470596791](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/35470596791) — **SUCCESS**
- Requirement coverage: **40 / 40**

The six reviewed D1 commits were transplanted onto the exact sealed baseline
without conflicts. The final code passes the D1 contract suite (14/14), full
unit suite (229/229), selection matrix and R10 verification, build, lint,
typecheck, local E2E (147/147), and hosted CI.

## Scope boundary

D1 is contract-only. It does not implement receptor or ligand preparation,
protonation, tautomer/stereoisomer/conformer/rotor generation, scoring,
search, optimization, RMSD, clustering, GPU docking, HTS, or D2 production
code. `DOCKING.RUN` remains reserved, unavailable, non-executable, and
fail-closed. No fake or random docking scores were added.

The only post-transplant code changes after the first hosted attempt were
test-only readiness/latency waits in
`tests/e2e/r07-b2-topology-edit.spec.ts`; they stabilize the existing
multi-object upload acceptance test and do not alter scientific behavior.

## Known non-D1 architecture findings

These were audited but intentionally not changed as part of D1 closure:

1. `apps/api/src/server.ts` does not explicitly bind the listener to loopback,
   while CORS is wildcard and no authentication layer is present. Safe local
   development depends on the process remaining local.
2. `apps/api/src/server.ts` accumulates request bodies without an explicit
   size cap. A production-facing deployment needs bounded JSON and multipart
   request limits.
3. `apps/api/src/command/dispatcher.ts` can report `SUCCEEDED` immediately
   for an asynchronously queued command; that status conflates enqueue success
   with execution completion.
4. The dispatcher cancellation path has a queue/cancel race that can allow a
   later microtask to overwrite a cancelled terminal state.
5. `ActionRecordStore` uses synchronous whole-file reads/appends without
   multi-process locking, rotation, or corruption recovery; it is local-process
   storage, not a multi-instance event store.
6. `SourceArtifactStore` is process-local in-memory state backed by a local
   filesystem root, so it is not a shared multi-instance artifact store.

## Next boundary

D2 must start from the accepted tag and must not silently promote any reserved
command to executable status. D2 remains unstarted at this closure.

