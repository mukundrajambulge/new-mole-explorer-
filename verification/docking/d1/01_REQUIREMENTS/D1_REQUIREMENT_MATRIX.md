# D1 Requirement Matrix

## Result

**40 / 40 authorized D1 requirements covered** by the transplanted contract
surface and the D1 acceptance suite.

| Requirement range | Acceptance surface | Fixture | Result |
|---|---|---|---|
| `ME-DCK-V1-REQ-0013` through `ME-DCK-V1-REQ-0028` | Canonical CBOR, exact F64Bits, identity separation, typed profiles, immutable request shape, state-separated aggregation | `INT-FX-001` | PASS |
| `ME-DCK-V1-REQ-0223` through `ME-DCK-V1-REQ-0242` | Durable job status, orthogonal preflight/capability/result/backend/campaign/event statuses, command metadata, fail-closed dispatcher | `INT-FX-002`, `INT-FX-003`, `INT-FX-004` | PASS |
| `ME-DCK-V1-REQ-0260` | D1 repository architecture and native-kernel absence | `INT-FX-004` | PASS |
| `ME-DCK-V1-REQ-0278` through `ME-DCK-V1-REQ-0280` | Contract-only workflow governance and unavailable docking command family | `INT-FX-004` | PASS |

The exact 40 IDs are exported by
`apps/api/src/docking/d1RequirementMatrix.ts` and are asserted for count,
uniqueness, acceptance-test mapping, and all four integration fixture names by
`apps/api/src/docking/d1Contracts.test.ts`.
