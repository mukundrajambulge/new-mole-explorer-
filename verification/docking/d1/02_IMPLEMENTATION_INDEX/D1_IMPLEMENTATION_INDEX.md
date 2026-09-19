# D1 Implementation Index

- Sealed baseline: `28a8dca64a4711ca4b9e00e13e19601e56404709`
- Accepted repaired candidate: `26227a10416657d0c2518bd0b751a38693627d5b`
- Accepted tag: `mole-explorer-docking-d1-accepted-2026-09-19`
- Requirement coverage: 40 / 40

| Requirement | Source file / symbol | Test | Fixture | Evidence |
|---|---|---|---|---|
| `ME-DCK-V1-REQ-0013` | `packages/contracts/src/docking/canonical.ts` — canonical CBOR | `d1Contracts.test.ts` — canonical contract round trip | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0014` | `packages/contracts/src/docking/canonical.ts` — canonical CBOR | `d1Contracts.test.ts` — canonical contract round trip | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0015` | `packages/contracts/src/docking/canonical.ts` — `F64Bits` | `d1Contracts.test.ts` — exact floating-point behavior | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0016` | `packages/contracts/src/docking/identity.ts` — scientific IDs and digests | `d1Contracts.test.ts` — identity separation | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0017` | `packages/contracts/src/docking/domain.ts` — molecular identity | `d1Contracts.test.ts` — PDBQT authority guard | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0018` | `packages/contracts/src/docking/domain.ts` — derived execution representation | `d1Contracts.test.ts` — PDBQT authority guard | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0019` | `packages/contracts/src/docking/profiles.ts` — typed scientific profiles | `d1Contracts.test.ts` — profile pinning | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0020` | `packages/contracts/src/docking/profiles.ts` — profile digests | `d1Contracts.test.ts` — profile pinning | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0021` | `packages/contracts/src/docking/requests.ts` — draft request | `d1Contracts.test.ts` — draft mutability | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0022` | `packages/contracts/src/docking/requests.ts` — frozen request | `d1Contracts.test.ts` — frozen request shape | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0023` | `packages/contracts/src/docking/requests.ts` — request policies | `d1Contracts.test.ts` — frozen request shape | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0024` | `packages/contracts/src/docking/requests.ts` — preflight references | `d1Contracts.test.ts` — frozen request shape | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0025` | `packages/contracts/src/docking/domain.ts` — state-separated result | `d1Contracts.test.ts` — no compound score | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0026` | `packages/contracts/src/docking/domain.ts` — aggregate contract | `d1Contracts.test.ts` — no compound score | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0027` | `apps/api/src/docking/scientificSerialization.ts` — `scientificDigest` | `d1Contracts.test.ts` — domain-separated digest | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0028` | `apps/api/src/docking/scientificSerialization.ts` — `artifactByteDigest` | `d1Contracts.test.ts` — byte digest contract | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0223` | `packages/contracts/src/docking/status.ts` — `COMMAND_JOB_STATES` | `d1Contracts.test.ts` — six-state guard | `INT-FX-002` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0224` | `packages/contracts/src/docking/status.ts` — preflight status | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0225` | `packages/contracts/src/docking/status.ts` — capability status | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0226` | `packages/contracts/src/docking/status.ts` — scientific result status | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0227` | `packages/contracts/src/docking/status.ts` — backend equivalence status | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0228` | `packages/contracts/src/docking/status.ts` — campaign status | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0229` | `packages/contracts/src/docking/status.ts` — execution events | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0230` | `packages/contracts/src/docking/status.ts` — scientific errors | `d1Contracts.test.ts` — status namespace guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0231` | `packages/contracts/src/docking/status.ts` — scientific warnings | `d1Contracts.test.ts` — status namespace guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0232` | `packages/contracts/src/docking/requests.ts` — request preflight | `d1Contracts.test.ts` — workflow guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0233` | `packages/contracts/src/docking/requests.ts` — execution policy | `d1Contracts.test.ts` — frozen request shape | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0234` | `packages/contracts/src/docking/requests.ts` — provenance policy | `d1Contracts.test.ts` — frozen request shape | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0235` | `packages/contracts/src/docking/domain.ts` — prepared receptor ref | `d1Contracts.test.ts` — identity separation | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0236` | `packages/contracts/src/docking/domain.ts` — prepared ligand ref | `d1Contracts.test.ts` — identity separation | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0237` | `packages/contracts/src/docking/domain.ts` — search region ref | `d1Contracts.test.ts` — identity separation | `INT-FX-001` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0238` | `packages/contracts/src/docking/domain.ts` — capability assessment | `d1Contracts.test.ts` — orthogonal status guard | `INT-FX-003` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0239` | `apps/api/src/command/registry.ts` — reserved docking metadata | `d1Contracts.test.ts` — fail-closed commands | `INT-FX-004` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0240` | `apps/api/src/command/registry.ts` — reserved HTS metadata | `d1Contracts.test.ts` — fail-closed commands | `INT-FX-004` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0241` | `apps/api/src/command/registry.ts` — unavailable capability state | `d1Contracts.test.ts` — fail-closed commands | `INT-FX-004` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0242` | `apps/api/src/command/dispatcher.ts` — no executable docking handler | `d1Contracts.test.ts` — dispatcher guard | `INT-FX-004` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0260` | `packages/contracts/src/docking/architecture.ts` — `DOCKING_REPOSITORY_ARCHITECTURE_V1` | `d1Contracts.test.ts` — architecture pin | `INT-FX-004` | `04_UNIT/D1_UNIT_REPORT.md` |
| `ME-DCK-V1-REQ-0278` | `apps/api/src/docking/d1RequirementMatrix.ts` — D1 evidence mapping | `d1Contracts.test.ts` — 40-ID mapping | `INT-FX-004` | `01_REQUIREMENTS/D1_REQUIREMENT_MATRIX.md` |
| `ME-DCK-V1-REQ-0279` | `apps/api/src/command/registry.ts` — reserved future families | `d1Contracts.test.ts` — fail-closed commands | `INT-FX-004` | `08_SCOPE_AUDIT/D1_SCOPE_NEGATIVE_AUDIT.md` |
| `ME-DCK-V1-REQ-0280` | `packages/contracts/src/docking/index.ts` — contract-only public surface | `d1Contracts.test.ts` — native-kernel absence | `INT-FX-004` | `08_SCOPE_AUDIT/D1_SCOPE_NEGATIVE_AUDIT.md` |

The evidence paths are relative to `verification/docking/d1/`.
