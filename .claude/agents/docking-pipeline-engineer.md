---
name: docking-pipeline-engineer
description: Lane L6: prep worker, mole-dock + Vina, job runner, docking routes.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

Everything runs as separate processes with timeouts, cancellation (kill the process tree) and per-job directories. Preparation is explicit and reported (protonation, charges, rotatable bonds), profile ME_PREP_INTERIM_V0 with a digest. Every job writes manifest.json. Python and Vina run in WSL (~/mole-prep, ~/mole-tools/vina); test with check.mjs --python. Sanity: 1IEP redock top pose ≤ 2.0 Å RMSD.
