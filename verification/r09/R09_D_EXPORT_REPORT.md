# R09-D Scientific Export

Status: PASS

## Implemented

- Typed export requests support PDB and mmCIF writers, frozen current/explicit/all-state scopes, frozen selected atom scopes, and explicit loss policies.
- Export captures the scientific revision, coordinate state scope, selection membership, writer profile/version, exact output byte length, SHA-256, and a semantic loss manifest.
- `FAIL_ON_LOSS` blocks artifact publication when known semantics would be lost. `ALLOW_WITH_MANIFEST` publishes only with visible loss entries.
- Export does not mutate the scientific workspace. Re-import sends the export artifact ID to acquisition and records `DERIVED_EXPORT` lineage on the new source artifact.
- The UI exposes format, state scope, loss policy, loss preview, exact hash, download, and re-import actions.

## Evidence and verification

- Web export suite: 2/2 passed for deterministic PDB/mmCIF output, frozen state, loss manifests, and `FAIL_ON_LOSS` refusal.
- Browser evidence: `export/09-export-dialog.png`, `export/10-export-loss-warning.png`, and `export/11-export-success.png`.
- Full browser regression: 113/113 passed, including re-import as a second durable object with derived-export provenance.

## Acceptance mapping

AT-R09-21 through AT-R09-26: PASS. Frozen selection/revision/state, artifact hash/profile, loss reporting, fail-on-loss, no scientific mutation, and new-source lineage are covered.

Runtime capability: PDB writer `SUPPORTED_WITH_LIMITATIONS`; mmCIF writer `SUPPORTED_WITH_LIMITATIONS`. The limitation is explicit semantic-loss reporting for fields outside the typed writer scope; no silent loss claim is made.
