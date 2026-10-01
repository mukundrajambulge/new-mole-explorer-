# D3-SCI-04 Test Log

Run date: 2026-10-01 (local task date). The runner verifies the clean native scoring directory and D3-TOR-01 commit before compiling.

Command:

```powershell
.\verification\d3-sci04\run.ps1 `
  -ZigExe 'C:\Users\mukun\.codex\tmp\d3-sci04-20261001\zig-portable\zig-x86_64-windows-0.16.0\zig.exe' `
  -PackageSha256 '68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e'
```

Result: exit code 0.

- Native C++ direct-scorer zero proof: `PASS`; 256 type pairs, 1,280 pair-distance checks, 880 omitted-HYD raw positive-zero checks, 800 omitted-HB raw positive-zero checks.
- Native C++ maximum-size allocation model: `PASS_FOR_RESEARCH_MODEL`; 1,331,000 points, 59 physical arrays, raw payload 628,232,000 B, requested field-owned allocation 674,904,616 B, latest peak working set 681,725,952 B.
- TypeScript conformance: Vitest 2.1.9; 1 test file passed, all 7 tests passed.

The full console output is preserved in [evidence/run-output.log](evidence/run-output.log). Toolchain and scorer source hashes are in [evidence/run-manifest.json](evidence/run-manifest.json). The measured RSS can vary slightly between model-process runs; every observed run remained below the unchanged caps.
