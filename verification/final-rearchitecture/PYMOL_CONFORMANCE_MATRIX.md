# PyMOL conformance matrix

This is a bounded compatibility audit, not a claim of complete PyMOL integration. The comparison uses the pinned open-source source tree at `5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`, official command documentation already cited by the project, and Molexplorer runtime tests. No executable PyMOL or importable pinned module is installed, so executable parity is `BLOCKED_ENVIRONMENT`.

| Capability | Molexplorer route | Test/evidence | Status | Limitation |
| --- | --- | --- | --- | --- |
| `select`, `within`, `byres` | Select rail; Console | AT-FSR-F-001; AT-FSR-I-001 | IMPLEMENTED_WITH_LIMITATIONS | Unsupported operators remain explicit outcomes; cross-object spatial queries require a frame. |
| `deselect` / `unpick` | Select rail; Escape; Console | AT-FSR-F-001 | IMPLEMENTED_WITH_LIMITATIONS | Shared canonical clear action. |
| `show`, `hide`, `color` | Display and Color rails; Console | R01–R06; selection closure | IMPLEMENTED_WITH_LIMITATIONS | Renderer profiles are qualified; exact pixel parity is not claimed. |
| measurements | Measure rail; Console | V-FINAL suites | IMPLEMENTED_WITH_LIMITATIONS | Revision-bound geometry and labels. |
| `rms`, `rms_cur`, `fit`, `pair_fit`, `align` | Analyze alignment workflow; Console; API | R08 suites | IMPLEMENTED_WITH_LIMITATIONS | No executable PyMOL oracle. |
| `super` | Analyze alignment workflow; Console; API | fitting unit tests | BLOCKED_ENVIRONMENT | Runtime is bounded; reference comparison pending. |
| `cealign` | Analyze unavailable state; Console returns unsupported | R10 runtime probe | UNSUPPORTED | Capability is registered but not implemented. |
| camera (`zoom`, `center`, `set_view`) | View rail; Console | camera viewport suite | IMPLEMENTED_WITH_LIMITATIONS | Presentation-only state. |
| sessions/scenes | File and Session | R09 suites | IMPLEMENTED_WITH_LIMITATIONS | PSE/PZE/movie work is out of scope. |
| host Python/shell/system | Safe boundary | securityFuzz and R10 suites | INTENTIONAL_SECURITY_DIVERGENCE | Arbitrary host execution is rejected. |
| trajectory data | Typed trajectory viewer for multi-frame XYZ/GRO/DCD/TRR/XTC with bounded coordinate decoding and atom-count-checked PSF/PRMTOP metadata pairing | AT-FSR-J-005/008/009/010/011; adapter tests | IMPLEMENTED_WITH_LIMITATIONS | Larger trajectory corpus/performance gates and broader topology identity remain pending. |
| movie playback | No active control | Planned | PLANNED | Requires a separate state-clock, animation, and export gate. |

The machine-readable version is [PYMOL_CONFORMANCE_MATRIX.json](PYMOL_CONFORMANCE_MATRIX.json). The larger historical 345-keyword inventory remains in `verification/autonomous-pymol` and `verification/r10` with explicit oracle-pending rows.
