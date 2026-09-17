# LM-IMP-001 — canonical 4V6F import remains outside the practical envelope

Status: **OPEN / ACCEPTANCE BLOCKER**

The official `4V6F.cif` source is 38,137,644 bytes with 307,345 atom rows. The 512 MiB upload ceiling and multipart handling now accept the file size, and the lightweight source scan completes with deterministic counts and membership hash. However, the canonical `StructureIngestionService` path still does not return within repeated 20-minute observation windows after parser, canonical-hash, and lazy-payload optimizations; the latest bounded attempt was cancelled after approximately four minutes at approximately 1.5–1.85 GiB Node memory.

This is not recorded as a successful canonical import. The source-scan artifacts are clearly labeled `LIGHTWEIGHT_SOURCE_SCAN`, and all dependent full-viewer, selection, render, and interaction gates remain blocked or degraded until the canonical identity payload is made bounded/streaming for this structure class.
