# Upstream Core Freeze Boundary

The following domains are frozen at `28a8dca64a4711ca4b9e00e13e19601e56404709` for the pre-docking checkpoint:

- structure ingestion, canonical identity, mmCIF/PDB metadata, and compact transport;
- large-structure progressive rendering and the viewer lifecycle contract;
- workspace/object identity, multi-object state, persistence, and selection ownership;
- selection grammar, canonical membership, named selections, state/model semantics, and locked fingerprints;
- representation, color, component visibility, camera, labels, measurements, and presentation projection;
- R07 editing/history, R08 alignment/analysis, R09 sessions/scenes/export, and R10 typed command validation;
- responsive shell geometry, rail ownership, console behavior, status reporting, and renderer adapter boundaries.

## Change rule

Docking work may consume these interfaces but must not casually alter them. A change inside this boundary requires an explicit upstream-core change request, a named owner, a rationale, a focused regression plan, and a new seal after the full acceptance gates pass.

The accepted 4V6F fixture and bulk evidence remain outside this source freeze. They are immutable verification inputs, not docking implementation inputs.
