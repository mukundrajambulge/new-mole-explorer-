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

## Runtime-unblock continuation regression

After the continuation's source-preflight/validation tooling and evidence updates, the repository regression was run again on 2026-10-04 with Node.js `v24.14.1` and npm `11.11.0`:

- `npm test`: PASS, 47 files / 254 tests (web 34/156, API 13/98).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS. Existing 3Dmol.js `eval` and large-chunk advisories remain.
- Native CMake/CTest in WSL2 Ubuntu 24.04.5 with CMake 3.28.3 / GCC 13.3.0: direct scorer and scoring-field tests PASS (2/2 targets, six fixture groups each). The maximum-geometry resource case passed; measurements are in `RESOURCE_VALIDATION.md`.
- Protected PyMOL browser regression: PASS, 3/3 Playwright tests. The two screenshot artifacts were restored from the clean pre-run checkout and their pre-run SHA-256 hashes verified.

Raw command output is preserved under `runtime_logs/continuation-*`; exits and scope are summarized in `runtime_logs/continuation-regression-run.txt`. These suites do not execute the fixture adapter, sealed molecular state generation, or direct/grid full-pose cohort. Those remain unrun because the source/profile alternate state is unresolved.

These are cumulative repository regressions on the corrected TOR parser revision. In the later runtime-unblock continuation, a task-local fail-closed source/preparation adapter was added, but the fixture adapter was not run through molecule construction or `AddHs` because the source/profile coordinate state is unresolved. No D3-specific fixture chemistry, numerical, or fixture-resource test result is claimed.

Follow-on validation on 2026-10-04 passed `npm run typecheck`, `npm run lint`, and `npm run build` on the corrected TOR parser. The build completed with the existing 3Dmol.js `eval` and large-chunk advisories. Detailed scope and the preserved bounded native/PyMOL evidence are in `CUMULATIVE_REGRESSION_REPORT.md`.
