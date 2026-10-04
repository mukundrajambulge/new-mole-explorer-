# Preparation replay report

**Status: PASS.** The authorized hydrogen-only fixture preparation ran twice under the same byte-exact sources, corrected v1.1 profile, Linux x86-64 runtime, pinned toolchain, command, and controlled environment.

- Runtime: WSL2 Ubuntu 24.04.5, CPython 3.13.16, RDKit 2026.03.6.
- Controlled environment: LANG=C.UTF-8, LC_ALL=C, PYTHONHASHSEED=0, TZ=UTC.
- Source hashes: 3DMX e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef; BNZ 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61.
- Run-1 and run-2 canonical scientific payload SHA-256: 212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f.
- Replay validation: PASS; all scientific artifacts identical.
- Heavy-atom additions/deletions/remappings/coordinate-bit changes: 0/0/0/0.
- Serialization round-trip maximum displacement: 0.0 Å (the allowed bound is 0.001 Å).
- Generated hydrogens: receptor 1,330; ligand 6.

Machine evidence is PREPARATION_REPLAY_VALIDATION.json. Per-run source/input/runtime/invariant and hydrogen-parent provenance are in prepared_states/run-1/ and prepared_states/run-2/. The pre-chemistry source/profile validator ran before each preparation.
