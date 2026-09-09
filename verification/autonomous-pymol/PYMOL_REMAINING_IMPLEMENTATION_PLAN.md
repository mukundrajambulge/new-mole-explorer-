# Remaining PyMOL implementation plan

The plan is bounded by Molexplorer's safe command contract and by the absence of an installed PyMOL executable in this environment. Each item requires source-pinned behavior, a deterministic fixture, application/REST/console convergence, and a direct oracle comparison before promotion.

## P0 — correctness blockers

No P0 blocker remains in the current claimed surface after the CEALIGN metadata correction. Keep the fail-closed parser, structured diagnostics, and the corrected unavailable capability state under regression.

## P1 — core structural-analysis closure

- **CEALIGN**: implement only with an explicit algorithm contract, residue correspondence rules, gap/transform semantics, and direct PyMOL oracle vectors; keep unavailable until then.
- **SUPER/ALIGN/FIT/RMS family**: expand correspondence, outlier rejection, transform matrix, and multi-state behavior tests against pinned source and executable oracle.
- **Selection and representation translations**: continue adding edge fixtures for alternate locations, insertion codes, nucleic acids, solvent, ions, and ligand boundaries.

## P2 — advanced scientific/query coverage

- Close the 228 ORACLE_PENDING source keywords by functional family, starting with analysis and measurement commands that have deterministic outputs.
- Add exact parser diagnostics for zero-result versus invalid syntax, and preserve membership hashes for every promoted query.
- Promote color/property/secondary-structure aliases only with documented equivalence and typed-property fixtures.

## P3 — lifecycle, PSE/PZE, movie and imaging references

- Keep PSE/PZE/session/movie/imaging names reference-only or coming-soon until a bounded format contract, size limits, and security review exist.
- Add export/import round-trip vectors and visual evidence before claiming lifecycle compatibility.

## Never execute

Python/code execution, shell/system, filesystem/network escape hatches, docking, and HTS remain rejected or design-only. No implementation plan may add an execution path for these namespaces.

## Completion gates

A row may move to supported only when its handler is registered, safety-preflighted, covered by unit and focused E2E tests, converges across GUI/REST/SDK, and has exact or explicitly documented equivalent PyMOL oracle evidence.
