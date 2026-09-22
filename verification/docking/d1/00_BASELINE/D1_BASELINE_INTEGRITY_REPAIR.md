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

Current repaired candidate before final acceptance gates:

`47f1a99325cdfb7a48c1a35ec2a18e143abc88fe`

This is a candidate SHA, not an accepted SHA, until all local, hosted, and
closure-evidence gates pass.

## Result

No cherry-pick conflicts occurred. The sealed-core comparison contains only the
authorized D1 contract, serialization, status, command registry, and test
surfaces plus this verification evidence.
