# Regression test report

The repository regression command was explicitly required by the integrated D3 task.

```text
npm ci
npm test
```

`npm ci` completed successfully from the committed lockfile and installed 248 packages. npm reported 6 dependency advisories during its install audit (3 moderate, 2 high, 1 critical); no dependency update or audit fix was applied.

`npm test` passed:

- Web: 34 test files, 156 tests.
- API: 13 test files, 97 tests.
- Total: 47 test files, 253 tests passed.

The captured command output and start/end/exit record are `runtime_logs/npm-test-output.txt` and `runtime_logs/npm-test-run.txt`.

The tests ran with Node.js `v24.14.1` and npm `11.11.0` on the Windows x64 worktree host.

These are cumulative repository regressions at the unchanged code parent. No preparation driver or full-pose validation code was added, so no D3-specific chemistry, numerical, resource, or security test was possible. The only tracked changes are closure evidence files and verified source copies.
