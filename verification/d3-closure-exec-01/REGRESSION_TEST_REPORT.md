# Regression test report

The repository regression command was explicitly required by the integrated D3 task.

```text
npm ci
npm test
```

`npm ci` completed successfully from the committed lockfile and installed 248 packages. npm reported 6 dependency advisories during its install audit (3 moderate, 2 high, 1 critical); no dependency update or audit fix was applied.

`npm test` passed:

- Web: 34 test files, 156 tests.
- API: 13 test files, 98 tests.
- Total: 47 test files, 254 tests passed.

The captured command output and start/end/exit record are `runtime_logs/npm-test-output.txt` and `runtime_logs/npm-test-run.txt`.

The tests ran with Node.js `v24.14.1` and npm `11.11.0` on the Windows x64 worktree host. The API count includes a regression proving that malformed atom serial field `0001X` fails with `D3_PDBQT_ATOM_SERIAL_INVALID`.

These are cumulative repository regressions on the corrected TOR parser revision. In the later runtime-unblock continuation, a task-local fail-closed source/preparation adapter was added, but the fixture adapter was not run through molecule construction or `AddHs` because the source/profile coordinate state is unresolved. No D3-specific fixture chemistry, numerical, or fixture-resource test result is claimed.

Follow-on validation on 2026-10-04 passed `npm run typecheck`, `npm run lint`, and `npm run build` on the corrected TOR parser. The build completed with the existing 3Dmol.js `eval` and large-chunk advisories. Detailed scope and the preserved bounded native/PyMOL evidence are in `CUMULATIVE_REGRESSION_REPORT.md`.
