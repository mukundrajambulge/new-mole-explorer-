# PyMOL movie and states implementation plan

Movie controls remain unavailable in the current release. Existing coordinate
states and typed trajectory metadata are deliberately kept separate from a
future playback engine.

| PyMOL movie capability | Current Mole state | Required implementation | Acceptance gate | Status |
| --- | --- | --- | --- | --- |
| State playback | Multi-state molecular objects and a frame slider for ready XYZ trajectories | Shared clock, play/pause/step, frame bounds, object-state synchronization | Deterministic frame changes with no stale renderer geometry | PLANNED |
| Scene sequence | Scene store/recall exists | Timeline references to immutable scene IDs | Scene ordering and recall remain exact after reload | PLANNED |
| Camera animation | Camera is presentation-only and directly controllable | Interpolated camera keyframes with bounded easing | No coordinate mutation; camera remains reversible | PLANNED |
| Spin / rock / nutate | Direct rotate interaction exists | Time-based presentation controller with cancel/reset | Continuous motion remains responsive and bounded | PLANNED |
| FPS / loop | No movie clock | Explicit FPS, loop mode, and dropped-frame diagnostics | Stable playback at declared limits | PLANNED |
| Interpolation | No interpolation | Per-state coordinate interpolation only where source semantics allow | No interpolation across incompatible objects/topologies | PLANNED |
| Frame rendering/export | Typed trajectory metadata and scene export exist | Rendered frame sequence export with provenance manifest | Reproducible frame count, format, and source hash | PLANNED |

Research trajectory policy: DCD and TRR decode bounded coordinate frames; XTC remains
metadata-only. Full XTC frame decoding, topology-coordinate pairing, and
performance limits must land before Movie is promoted from the unavailable
right-rail state. This plan does not authorize docking or HTS.
