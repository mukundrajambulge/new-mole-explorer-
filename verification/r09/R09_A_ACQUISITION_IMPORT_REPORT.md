# R09-A Acquisition and Import Integrity

Status: PASS

## Implemented

- Local uploads hash the exact backend `Buffer` before UTF-8 decoding and seal a `SourceArtifact` with byte length, raw SHA-256, acquisition metadata, format evidence, parser profile, and persistent storage reference.
- RCSB/wwPDB acquisition uses `Response.arrayBuffer()` and hashes the received bytes before decoding. Provider, accession, URI, response metadata, retrieval time, and media type are retained.
- PDB and mmCIF/CIF are the admitted production formats. Extension/content evidence is checked explicitly; mismatches return `FORMAT_MISMATCH`, and unadmitted extensions return `UNSUPPORTED_FORMAT`.
- The 25 MB resource limit is enforced before source publication. Parser failures and foreign `.pse`/`.pze` inputs return structured errors without a workspace publication path.
- `molexplorer-scientific-canonical-json-v1` defines deterministic scientific hashing independently from exact source-byte identity.

## Evidence and verification

- API ingestion suite: 34/34 passed, including local provenance, LF/CRLF distinction, mocked raw RCSB `arrayBuffer` acquisition, exact upload boundary, format policy, export re-import lineage, and secure foreign-session rejection.
- Browser evidence: `verification/evidence/r09/acquisition/01-two-object-workspace-before-save.png`.
- Full browser regression: 113/113 passed; the inherited malformed-load test confirms the current workspace remains rendered after a failed import.

## Acceptance mapping

AT-R09-01 through AT-R09-08: PASS. Exact raw evidence and scientific identity are separate; PDB/mmCIF provenance is complete; limits, parser failures, format policy, collision handling, and transactional browser publication are covered.

Known boundary: `.pse` and `.pze` are rejected as untrusted foreign serialized input. They are not parsed or deserialized in the native scientific process.
