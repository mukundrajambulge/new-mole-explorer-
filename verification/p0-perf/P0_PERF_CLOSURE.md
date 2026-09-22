# MOLE EXPLORER — P0-PERF WORKSTATION CONSOLIDATION & PERFORMANCE CLOSURE

P0-PERF STATUS: PASS — WORKSTATION CONSOLIDATED / PERFORMANCE BASELINE SEALED

Closure date: 2026-09-21
Canonical worktree: `C:\Users\mukun\.codex\worktrees\molecular-workstation-p0-perf`
Branch: `codex/p0-perf-consolidation`
Implementation commit: `f773b7fcf0a6f16b23f9abc760fa9d2292b63061`
Closure documentation commit: `11fd59707112113af7f1b87fb3a7832e47e22b42`
Accepted tag: `mole-explorer-p0-perf-accepted-2026-09-21`
Drive closure folder: `1efS0XnacsfWZzKI9ygatZNlZsMg80hxl`

## Protected baselines

- D1 `mole-explorer-docking-d1-accepted-2026-09-19` → `26227a10416657d0c2518bd0b751a38693627d5b`
- D2 `mole-explorer-docking-d2-accepted-2026-09-20` → `ba2ffb4eb28a00ee945086b24f39bf639ca2250c`
- UI-D0 `mole-explorer-docking-ui-d0-accepted-2026-09-20` → `d63c2126bb27d6513166e5f90375c213c314fa0c`

All three local commits match their dereferenced `new-origin` tag commits. No accepted baseline tag was rewritten or deleted.

## Delivered

- Canonical hashing now buffers large hash writes and caches verified object-key orders while preserving canonical bytes and scientific hashes.
- Renderer reconciliation now separates scene, camera, selection, label, and transient interaction dirty classes. Camera/hover/pick/measurement updates do not reload models or restyle the full workspace.
- Compact stable-ID indicator lookup is cached instead of repeatedly scanning the full ID array.
- Camera, selection, and label host diagnostics are synchronized on presentation-only updates.
- CI has a fast branch/PR lane and a serialized full-acceptance lane on `main`/`dev` or explicit manual dispatch; the full E2E command remains intact.
- Production architecture and hardening-risk records are in `docs/architecture/P0-PERF-ARCHITECTURE.md`.
- Four clean duplicate folders were removed after verification; their branches/commits remain retained. Dirty user/evidence worktrees were not deleted.

## Performance evidence

4V6F (38.6 MB, 307,345 atoms): 24.92 s accepted baseline → 17.60 s P0 elapsed, with scientific hash unchanged at `20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913`. Post-run RSS sample was approximately 1.23 GB and is retained as a capacity-planning risk, not a peak-memory claim.

Renderer production probe: viewer/model/scene/projection counts remained `1/1/1/1` during load, camera drag, representation change, and surface change. Camera drag held workspace style rebuilds at `2`; representation and surface changes advanced them to `3` and `4`.

## Verification

- `npm run typecheck --workspaces` — PASS
- `npm run lint --workspaces` — PASS
- `npm test` — PASS: web 156, API 90
- `npm run build` — PASS
- Focused camera and UI-D0 docking tests — PASS: 4/4
- Serialized browser acceptance — 145/150 passed in the full run; the five remediation cases were rerun with API port 8100 and the final frontend and passed 5/5. Unique-case closure: 150/150 PASS.
- Final renderer production probe — PASS
- CI workflow YAML parse and `git diff --check` — PASS

## Live workstation services

- API backend: `http://localhost:8100` (running from the sealed P0 worktree)
- Production web preview: `http://127.0.0.1:3106/` (rebuilt with API base `http://127.0.0.1:8100/api`)

## Production blockers carried forward

- No authentication/authorization boundary for a public deployment.
- Wildcard CORS and no deployment-origin allow-list.
- File-backed JSON/session storage and process-local job authority are workstation-only.
- No durable queue/object storage/cancellation fencing for multi-instance execution.
- `npm ci` reports five dependency advisories: three moderate, one high, one critical.
- 3Dmol emits an `eval` warning and the main bundle is approximately 1.4 MB minified / 388 kB gzip.

D3 scoring/search was intentionally not implemented.
