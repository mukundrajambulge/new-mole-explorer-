# Heavy-atom invariance report

**Status: PASS for both fixture components in both deterministic preparation runs.**

The source-selected receptor has 1,306 heavy atoms and BNZ has 6. In-memory comparison reports zero heavy-atom additions, deletions, identity remappings, or coordinate-bit changes. Heavy-heavy bonds are unchanged, and original input graphs remain unchanged. The maximum serialized/read-back coordinate displacement is 0.0 Å, within the permitted 0.001 Å check.

The exact input hashes are recorded in PREPARATION_REPLAY_VALIDATION.json and the per-run manifests. The combined heavy-atom invariant digest is sha256:a24667ec9d1eb3a6ad27bbc4c65ee57c2b40d0f9352b5e325a28583b10dc447a. Both independent preparation outputs have canonical scientific payload digest sha256:212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f.

Per-run selected-atom manifests and invariant records are in prepared_states/run-1/ and prepared_states/run-2/. This is fixture-derived evidence; the earlier synthetic-only status is historical.
