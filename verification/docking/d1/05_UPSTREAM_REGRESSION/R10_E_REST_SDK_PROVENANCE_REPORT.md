# R10 E REST SDK PROVENANCE REPORT

Status: PASS_VERSIONED_BOUNDARY. POST /api/v1/commands/execute accepts typed CanonicalCommand input; raw compatibility text remains on the legacy command-service boundary. A typed SDK facade submits through that same service, registry discovery is versioned, replay supports REVIEW/COMMAND_REPLAY/REPRODUCTION_ATTEMPT, and ActionRecord JSONL history retains redacted intent, schema/handler/policy/version refs, input/output refs, validation diagnostics and attempt lineage.
