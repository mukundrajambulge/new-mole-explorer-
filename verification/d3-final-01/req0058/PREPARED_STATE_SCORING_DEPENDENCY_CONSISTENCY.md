# Prepared-State / Scoring-Field Dependency Consistency

## Separate identities

PreparedReceptorState V2 records the stable profile identities used by the receptor's downstream scientific interpretation. ScoringFieldIdentity remains a separate child artifact, and retains its field payload, assignment dependencies, geometry, numerical backend and field-specific digests. Receptor atom-typing assignments remain child data linked to the receptor, not copied into its parent state digest.

## Shared dependencies compared

`preparedReceptorMatchesScoringFieldDependencies` checks receptor profile ID plus matching profile ID and digest for the shared chemistry, receptor-typing and scoring dependencies. The predicate returns false on any disagreement; there is no default/global fallback. Its focused test checks a matching bundle and a deliberately changed scoring digest.

The corrected full-pose input validator also compares embedded receptor profile references with the scoring, typing and chemistry profile IDs/digests before field build. The V1 receptor-state envelope is rejected. The focused full-pose smoke run passes five synthetic cases, including mismatch and legacy-state rejection.

## Circularity and limits

The receptor stores content references to named profile definitions. It does not store the scoring-field digest, a typing-assignment digest, or a digest that itself includes the receptor, so there is no identity cycle. The field identity independently binds its receptor-state and assignment dependencies. This correction establishes profile-consistency at the D3 scoring-field seam; it does not expose or enable `DOCKING.RUN`.
