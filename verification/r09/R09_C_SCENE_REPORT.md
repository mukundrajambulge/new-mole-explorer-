# R09-C Renderer-Neutral Scenes

Status: PASS

## Implemented

- `SceneStore` owns immutable scene records and a scene collection containing stable scene IDs, ordering, object/scientific revision refs, state refs, active object, camera/projection, representation, visibility, colors, labels, background, axes, and supported view dimensions.
- Store, recall, update, rename, delete, previous, next, and ordering operations return structured failures for missing or stale dependencies.
- Scene recall projects presentation onto the current workspace without changing canonical atoms, topology, coordinates, scientific hashes, or scientific history.
- The UI exposes a bounded Scene Manager with scene cards, dependency status, captured dimensions, and lifecycle actions.

## Evidence and verification

- Web scene suite: 2/2 passed for lifecycle operations, stable references, stale-reference rejection, missing-dependency rejection, and science immutability.
- Browser evidence: `scenes/06-scene-a.png`, `scenes/07-scene-b.png`, and `scenes/08-scene-recall-a.png`.
- Full browser regression: 113/113 passed.

## Acceptance mapping

AT-R09-16 through AT-R09-20: PASS. Scene store/recall, stable IDs/revisions, dependency failures, science immutability, and metadata-only scene operations are covered.
