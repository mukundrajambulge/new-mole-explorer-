# P0-PERF workstation baseline and closure evidence

Baseline source: `mole-explorer-docking-ui-d0-accepted-2026-09-20` (`d63c2126bb27d6513166e5f90375c213c314fa0c`). Measurements were run from the clean P0 worktree with Node 24.14.1, the locked npm dependency tree, and the committed 4V6F source fixture (`38,555,766` bytes).

## Ingestion measurements

The repeatable harness is `verification/p0-perf/measure-ingestion.ts`. The large-structure run used `MOLEXPLORER_INGESTION_PROFILE_PATH` so stage timings and memory samples are retained as JSONL.

| Fixture | Baseline elapsed | P0 elapsed | Result | Scientific identity |
| --- | ---: | ---: | --- | --- |
| `tests/fixtures/mini-protein.pdb` (1,214 B) | 10.39 ms | 6.55 ms | PASS | `fa1524d6d571617208dd1bea5822b0ffa44c5c3f3353e923e019b5d9a7d69c37` unchanged |
| `tests/fixtures/g1c-small-molecule.pdb` (342 B) | 13.83 ms | 5.35 ms | PASS | `df756035ad07fd030ced2c1a0eed09a40af620a2a58eb352e30b959244f7f726` unchanged |
| `verification/large-molecule-4v6f/01-source/4v6f.cif` (38.6 MB; 307,345 atoms) | 24.92 s | 17.60 s | PASS | `20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913` unchanged |

The 4V6F post-run RSS sample was approximately 1.23 GB. RSS is a process-level sample after forced GC, not a claim of peak working-set measurement; the retained compact payload and Node allocator behavior must remain visible in production capacity planning.

### Stage evidence

The accepted baseline spent approximately 12.3 s inside `CANONICAL_HASH` and finished in 24.92 s. After the fix, canonical hashing finished at 16.82 s and the complete ingestion finished at 17.60 s. The other material stages remained semantically unchanged: atom-row extraction, bond graph construction, secondary indexes, polymer typing, compact payload creation, and canonical object construction.

The fix in `apps/api/src/lifecycle/canonicalSerialization.ts` is presentation-independent: it buffers canonical hash writes in 64 KiB chunks and caches sorted object-key orders by verified object shape. It produces the same canonical bytes and therefore the same scientific hash; the canonical serializer tests and the three fixture identity checks cover that invariant.

## Renderer measurements

`verification/p0-perf/renderer-baseline.mjs` runs against the production Vite preview and a matching API process. On the P0 build:

| Operation | Viewer creations | Model loads | Scene rebuilds | Projection rebuilds | Workspace diagnostics | Workspace style rebuilds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Loaded mini-protein | 1 | 1 | 1 | 1 | 0 | 2 |
| Camera drag | 1 | 1 | 1 | 1 | 0 | 2 |
| Representation change | 1 | 1 | 1 | 1 | 1 | 3 |
| Surface change | 1 | 1 | 1 | 1 | 2 | 4 |

Camera interaction therefore remains presentation-only: it increases native render calls but does not reload models, rebuild the scene, rebuild projection styles, or recompute workspace diagnostics. The P0 dirty-class fix in `ThreeDMolViewerAdapter.ts` also prevents hover/pick/measurement-only interaction updates from resetting every workspace model; only a changed selected-atom membership resets base styles. Compact stable-ID lookup is cached instead of using a linear `indexOf` scan for every indicator.

The final probe after the camera/selection/label synchronization fixes retained the same counters: loaded `1/1/1/1`, camera drag `1/1/1/1`, representation `1/1/1/1`, and surface `1/1/1/1` for viewer creations/model loads/scene rebuilds/projection rebuilds. Camera drag remained at two workspace style rebuilds; representation and surface changes advanced that counter to three and four respectively.

## Browser regression closure

The serialized browser suite completed all 150 unique acceptance cases. The first 150-case run recorded 145 passes and five failures caused by two execution-order conditions: four R10 tests started before the explicitly required API on port `8100` was running, and the custom-label assertion ran before the final diagnostics synchronization patch was hot-loaded. The five cases were rerun with the validated API on `8100` and the final frontend build; all five passed. Therefore the unique-case closure is `150/150 PASS` across the full run plus its targeted remediation rerun.

The final renderer fixes synchronize observable host diagnostics for camera-only, selection-only, and label-only workspace updates without adding scene/model rebuilds. This closed the stale `manual` clipping, stale selected-atom count after Escape, and stale custom-label mode failures found during acceptance.

## Regression commands

```text
npm run typecheck --workspaces
npm run lint --workspaces
npm test
npm run build
node --expose-gc node_modules/tsx/dist/cli.mjs verification/p0-perf/measure-ingestion.ts tests/fixtures/mini-protein.pdb
node --expose-gc node_modules/tsx/dist/cli.mjs verification/p0-perf/measure-ingestion.ts tests/fixtures/g1c-small-molecule.pdb
node --expose-gc node_modules/tsx/dist/cli.mjs verification/p0-perf/measure-ingestion.ts verification/large-molecule-4v6f/01-source/4v6f.cif
node verification/p0-perf/renderer-baseline.mjs
```

## Known limits retained as explicit risks

- 3Dmol.js emits an `eval` warning and the production JavaScript bundle remains approximately 1.4 MB minified / 388 kB gzip. This is a dependency and code-splitting risk, not a new P0 regression.
- The local API uses file-backed JSON/session manifests and local source-artifact storage. It is suitable for a single workstation, not a multi-tenant deployment.
- API authentication, authorization, durable job queueing, object storage, and cancellation fencing are not admitted by the current workstation scope and remain production blockers until implemented behind the control-plane boundary.
- CORS is currently wildcard and the API route does not yet enforce a deployment origin allow-list. This is a production hardening blocker.
- `npm ci` reports five advisories in the locked dependency tree (three moderate, one high, one critical). Dependency triage is required before a public deployment.
