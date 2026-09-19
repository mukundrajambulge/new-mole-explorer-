# D1 Baseline Integrity Repair

## Baseline finding

- Original D1 candidate: `e330abc9875409b579f8e41fe36296c8aaab8d04`
- Original D1 base: `b7f075fc28b83323b275f249af8af26ddfcbc0ed`
- Required sealed baseline: `28a8dca64a4711ca4b9e00e13e19601e56404709`
- Immutable sealed tag: `mole-explorer-pre-docking-core-2026-09-19`
- Original relation: `DIVERGED`
- Original merge base: `b7f075fc28b83323b275f249af8af26ddfcbc0ed`

The immutable tag was verified locally before creating the repair worktree. The
repair worktree started at the exact sealed SHA and was clean.

## Repair strategy

The six reviewed D1 commits were cherry-picked one at a time, in their required
order, onto the sealed baseline. The historical branch and candidate were not
rewritten or force-pushed.

Final repaired candidate after local and hosted acceptance gates:

`26227a10416657d0c2518bd0b751a38693627d5b`

This SHA is accepted by local gates, hosted run `35470596791`, and the
annotated tag `mole-explorer-docking-d1-accepted-2026-09-19`.

## Result

No cherry-pick conflicts occurred. The sealed-core comparison contains only the
authorized D1 contract, serialization, status, command registry, and test
surfaces plus this verification evidence.
