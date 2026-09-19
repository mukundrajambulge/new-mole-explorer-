# Protected Upstream Regression Report

- `npm run verify:selection-matrix`: PASS; 87 rows, 85 verified working, 1 missing dependency, 1 intentionally unsupported, 51 oracle pass, 35 oracle equivalent, 1 oracle pending.
- `npm run verify:r10`: PASS; generated the R10 compatibility, command, compiler, dispatcher, settings, REST/SDK, macro/batch, and closure reports.
- Existing generated upstream reports were copied into this directory as evidence; pre-existing tracked baseline reports were restored so the D1 source diff remains bounded.

The D1 change set does not modify the frozen upstream implementation surfaces.
