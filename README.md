# Molecular Workstation

Greenfield browser-based scientific molecular workstation. The current visualization gate provides canonical structure ingestion, local PDB/mmCIF loading, RCSB retrieval, renderer-neutral presentation state, and a real 3Dmol.js projection.

## Run locally

```bash
npm install
npm run dev
```

The public landing app runs on `http://localhost:3100` and links to the scientific workstation at `http://localhost:3101/molstudio`. The API health endpoint runs on `http://localhost:8100/api/health`. Port `5173` is intentionally left untouched for any legacy application.

The strict local topology is:

- landing: `3100`
- workstation: `3101`
- API: `8100`

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The Playwright test expects the workstation at `http://localhost:3101`; it can start the Vite server automatically when run through the root script.

## Architecture

```text
Canonical molecular structure (apps/api)
  -> renderer-neutral RenderProjection (apps/web/src/rendering)
  -> ThreeDMolViewerAdapter (one owner per mounted canvas)
  -> 3Dmol.js (rendering dependency)

Browser UI
  -> typed UI actions and presentation state (apps/web/src/domain, apps/web/src/rendering)
  -> typed API client (apps/web/src/lib)
  -> API ingestion/project boundary (apps/api)
```

The backend canonical structure is the scientific authority. Stable atom, residue, chain, bond, coordinate, provenance, and property identities cross the projection boundary; 3Dmol internal indices do not. Unsupported controls remain explicit Coming Soon/Unavailable capabilities rather than producing substitute scientific output.
