# D3-SCI-04 Sparse Grid Semantics and C++ Resource Proof

This directory contains a test-only research harness for the owner-approved conditional Architecture B direction. It keeps the 80 logical IDs fixed and models the proposed 59 physical arrays. It does not implement or expose a production ScoringField, interpolation path, search, or docking workflow.

## Evidence inputs

- Direct scoring oracle: the unchanged D3-TOR-01 scorer at commit f0bd2eaf47b02faab4dea694e7c2677094969076.
- Type and term contract: current PHD-V2-06.
- Floating serialization and digest envelope: current PHD-V2-10, including ME_CANONICAL_CBOR_V1_1_0 and F64Bits.
- Resource ceilings: current PHD-V2-13.
- The 80-logical/59-physical mapping and physical schema identifiers in this directory are research fixtures, not normative schemas.

## Run

Use the portable Zig C++ compiler version 0.16.0. From the repository root, run:

```powershell
.\verification\d3-sci04\run.ps1 `
  -ZigExe 'C:\path\to\zig.exe' `
  -PackageSha256 '68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e'
```

The runner requires the preserved D3-TOR-01 commit and a clean native scoring directory; it checks the expected Zig version and executable/package hashes. It obtains Vitest 2.1.9 from the repository lockfile.

The runner compiles the existing direct scorer with the zero-proof fixture, then compiles and runs the maximum-size C++ allocation model. It writes the channel map and machine-readable results to evidence/. The full scope and caveats are in [D3-SCI04_REPORT.md](D3-SCI04_REPORT.md).

## Scope and interpretation

The native proof exhausts all 256 receptor/ligand XS type pairs at five interior surface distances, checks exact positive-zero raw HYD/HB values for omitted ligand channels, and checks the +0.0 times negative coefficient = -0.0 bit pattern.

The serializer fixture uses the existing canonical CBOR encoder and the PHD-V2-10 digest envelope. Its SCORING_FIELD_STORAGE_V1 payload and physical schema labels are proposed test identifiers only. The sample logical field is intentionally small; it proves canonical equivalence and signed-zero behavior, not full-grid serialization throughput.

The C++ resource model allocates and touches all 59 arrays at 1,331,000 points, constructs an explicit maximum-size receptor spatial-index model, and reserves field-build scratch for eight workers. It records requested field-owned allocations and Windows peak RSS separately. It is research evidence against a concrete candidate layout, not measurement of a future production ScoringField implementation. Any production layout change requires its own resource measurement.

No prepared protein-ligand states are created or read. Full-pose numerical accuracy, threshold selection, D3 acceptance, and production resource acceptance remain outside this stage.
