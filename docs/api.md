# G1B API contract

The API is the authoritative ingestion and project boundary. The running local API is `http://localhost:4310`; the web app proxies `/api` to it.

## Readiness

- `GET /api/health` → `HealthResponse` (`gate: G1B`)
- `GET /api/bootstrap` → `BootstrapResponse` with explicit capability states

## Structure ingestion

- `POST /api/structures/upload` with multipart field `file` → `StructureLoadResult`
- `POST /api/structures/rcsb` with JSON `{ "pdbId": "1CRN" }` → `StructureLoadResult`

`StructureLoadResult.structure` includes source kind, original filename, format, exact-byte SHA-256, byte length, optional RCSB URI, parser profile, stable atom IDs, explicit canonical bonds, chain/residue hierarchy, coordinate bounds, counts, and scientific hash. `renderSource` is the exact fetched/uploaded content used as the renderer input; it is not scientific authority.

## Project lifecycle

- `POST /api/projects` with optional JSON `{ "name": "Untitled Project" }` → `201 ProjectRecord`
- `GET /api/projects/:id` → `ProjectRecord`
- `PUT /api/projects/:id` with `ProjectSaveRequest` → `ProjectRecord`

`ProjectRecord` contains schema version, revision, timestamps, the complete structure load result or null, and a renderer-neutral `ProjectPresentationState`. Save supports an optional `expectedRevision`; a mismatch returns HTTP 409 and does not overwrite the current manifest. Unknown project IDs return HTTP 404. Export has no endpoint in this gate because the capability is explicitly Coming Soon.
