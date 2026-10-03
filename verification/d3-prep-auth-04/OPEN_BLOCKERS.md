# Open blockers — D3-PREP-AUTH-04

## Blocks AUTH04 gate exit and D3-PREP-EXEC-04

1. **Roadmap independent evidence review is absent.** The current Execution Roadmap requires an independent evidence review for gate closure. No independent reviewer report or sign-off is present in this lane. Until it is completed and recorded, do not mark AUTH04 PASS, generate an execution prompt, or begin preparation.

## Execution preconditions after the review closes

These are fail-closed execution checks, not unresolved owner decisions:

- reverify the owner authorization, exact profile and all DEC04 source hashes;
- install/verify CPython 3.13.16 x64 and every pinned wheel using the exact listed artifact hashes;
- verify the corrected RDKit Python wrapper signature and no-query-atom/bond precondition;
- seal the preparation driver/config hashes before graph construction and before the first AddHs call;
- validate graph completeness, the 164-residue construct, 51 side-chain identities plus two termini, GLU128−, BNZ graph, altloc coherence and occurrence-level component dispositions;
- require deterministic replay, full hydrogen provenance and bitwise heavy-atom invariance;
- fail closed on any discrepancy and preserve all diagnostics.

## Resolved owner decisions

AUTH04-01, AUTH04-02 and AUTH04-03 are all **OWNER APPROVED — YES** as recorded in `OWNER_AUTHORIZATION_RECORD.md`. The approved exception remains single-use and fixture-specific; no general profile or production capability is approved.

## Preserved boundaries

No preparation or hydrogen addition occurred in AUTH04. D1/D2 semantics, PyMOL, `CORE_DRY_V1`, scoring, grids, search, D4 and `DOCKING.RUN` are unchanged. Full D3 remains HOLD; D4 remains BLOCKED; `DOCKING.RUN` remains UNAVAILABLE.