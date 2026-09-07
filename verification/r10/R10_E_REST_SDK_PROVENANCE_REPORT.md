# R10 E REST SDK PROVENANCE REPORT

Status: PASS. POST /api/commands accepts safe raw syntax or a CanonicalCommand, registry discovery is GET /api/commands/registry, history is GET /api/commands/history, replay is POST /api/commands/history/:id/replay, and async job status/cancellation are exposed under /api/commands/jobs. Idempotency, correlation, redacted source, semantic hash, policy/profile versions and diagnostics are written to ActionRecord JSONL history.
