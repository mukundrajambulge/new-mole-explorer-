# Slice B — PQR and SDF coordinate adapters

PQR is admitted as a coordinate-bearing molecular object. The adapter parses PDB-like atom identity, optional chain IDs, coordinates, charge, and radius. It validates that every radius is positive. Source charge values are retained in a complete revision-bound partial-charge dataset only when every admitted atom supplies a finite charge. PQR radii are intentionally not used as a global renderer radius override.

Verification:

- `npm test --workspace @molecular/api -- --run src/structures/ingestion.test.ts`: 27 passed.
- `npx playwright test tests/e2e/final-rearchitecture-shell.spec.ts --config playwright.config.ts`: 3 passed, including `AT-FSR-B-001`.
- Visual evidence: `evidence/SLICE_B_PQR_IMPORT.png`.

SDF/MOL V2000 now provides a second bounded 3D adapter: a single molecule can be imported with its declared bond orders; multi-record files are rejected. Other requested file families remain explicitly unsupported until their appropriate model adapters and corpus acceptance tests exist.
