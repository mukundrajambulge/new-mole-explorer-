# Visualization completion surface profile matrix

Each profile has distinct parameters, cache identity, target/contributor semantics, and an explicit implementation status. Canonical coordinates, element VDW radii, stable atom IDs, and canonical occlusion membership come from the backend structure; the frontend owns only the projection and cache lifecycle.

| Profile | `profile_id` | Radius source | Probe radius | Occluders | Resolution / quality | Generator | Status |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| VDW | `surface.vdw.element-vdw.v1` | canonical element VDW radius | 0.0 Å | all canonical coordinate atoms | configurable quality | 3Dmol native VDW surface | SUPPORTED_WITH_LIMITATIONS |
| SAS | `surface.sas.element-vdw.probe-1.4A.v1` | canonical element VDW radius | configurable, default 1.4 Å | all canonical coordinate atoms | configurable quality | 3Dmol native surface with probe | SUPPORTED_WITH_LIMITATIONS |
| SES | `surface.ses.element-vdw.probe-1.4A.v1` | canonical element VDW radius | configurable, default 1.4 Å | all canonical coordinate atoms | configurable quality | 3Dmol native surface with probe | SUPPORTED_WITH_LIMITATIONS |
| MESH | `surface-mesh.v1` | canonical element VDW radius | 0.0 Å | all canonical coordinate atoms | configurable quality | native VDW surface with wireframe material | SUPPORTED_WITH_LIMITATIONS |
| DOTS | `surface-dots.v1` | canonical element VDW radius | 0.0 Å | all canonical coordinate atoms | configurable density | deterministic exposed-point GLShape | SUPPORTED_WITH_LIMITATIONS |
| DOT_SURFACE | `surface-dot-surface.v1` | canonical element VDW radius | configurable, default 1.4 Å | all canonical coordinate atoms | configurable density | deterministic probe-expanded exposed-point GLShape | SUPPORTED_WITH_LIMITATIONS |

All profiles record `coordinate_state=active`, `target_atoms=style_target_atoms`, `contributor_atoms=target_plus_explicit_occluders`, a revision-aware cache key, and `color_source=atom_color_state`. SAS and SES remain distinct profiles even when they use the same probe radius; their profiles are not conflated. Native surfaces are limited by 3Dmol's material/color API, while dots use a deterministic frontend projection. Async surface work is generation-guarded so stale results cannot replace a newer projection.
