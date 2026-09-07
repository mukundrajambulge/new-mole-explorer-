# R10-H Docking/HTS Namespace Design

Status: DESIGN ONLY — no docking or high-throughput execution is implemented or enabled.

The reserved command families are `DOCKING.CONFIGURE`, `DOCKING.RUN`, `DOCKING.CANCEL`, `HTS.INGEST`, `HTS.SCREEN`, and `HTS.REPORT`. They must use the same `CommandSpec`, `CanonicalCommand`, capability preflight, resource policy, asynchronous Job state machine, ActionRecord, and provenance boundary as scientific commands.

The current capability state is `UNAVAILABLE`. A future implementation must require an explicitly admitted engine capability, bounded input artifact references, deterministic parameter profiles, server-side resource quotas, cancellation, output artifact hashes, and redacted provenance. No command in this namespace may enable arbitrary shell, Python, JavaScript, downloader, or host-filesystem execution. `DOCKING.RUN` remains unavailable in the current API and no job is created for it.
