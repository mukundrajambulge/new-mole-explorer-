# Molecular Workstation

Greenfield G0 foundation for a future browser-based scientific molecular workstation.

This repository intentionally contains only the application foundation: a responsive workstation shell, typed action and capability registries, an API boundary, a renderer projection placeholder, and test scaffolding. It does not import or depend on the former Mole Explorer/Molexplorer implementation and does not implement molecular science, editing, measurement, preparation, or docking.

## Run locally

```bash
npm install
npm run dev
```

The web app runs on `http://localhost:5173` and the API health endpoint runs on `http://localhost:4310/api/health`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The Playwright test expects the web app to be available at `http://localhost:5173`; it can start the Vite server automatically when run through the root script.

## Architecture

```text
Browser UI
  -> typed UI actions (apps/web/src/domain)
  -> typed API client (apps/web/src/lib)
  -> API boundary (apps/api)
  -> future application services / scientific domain / persistence

Scientific state (future)
  -> render projection (apps/web/src/components/MolecularCanvas.tsx)
  -> browser molecular renderer (future)
```

The renderer is a non-authoritative G0 preview. Unsupported controls report their capability state instead of creating fake scientific output.
