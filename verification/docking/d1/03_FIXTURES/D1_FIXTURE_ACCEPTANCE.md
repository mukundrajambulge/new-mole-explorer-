# D1 Fixture Acceptance

| Fixture | Required invariant | Evidence | Result |
|---|---|---|---|
| `INT-FX-001` | Deterministic canonical CBOR; exact F64Bits including signed zero and subnormal; nonfinite rejection; domain-separated digests; identity separation; no canonical compound score | `d1Contracts.test.ts` canonical contract round-trip block | PASS |
| `INT-FX-002` | Durable `JobStatus` is exactly `Created`, `Queued`, `Running`, `Completed`, `Failed`, `Cancelled` | `d1Contracts.test.ts` six-state guard | PASS |
| `INT-FX-003` | Preflight, capability, scientific-result, backend-equivalence, campaign, and execution-event statuses remain orthogonal to `JobStatus` | `d1Contracts.test.ts` orthogonal status guard | PASS |
| `INT-FX-004` | PDBQT is derived execution representation; docking commands remain unavailable; dispatcher creates no job and no result | `d1Contracts.test.ts` PDBQT authority and unavailable-command guard | PASS |

All 14 tests in the D1 contract file passed on the repaired candidate.
