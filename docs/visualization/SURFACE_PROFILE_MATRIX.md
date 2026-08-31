# G1C surface profile matrix

G1C establishes the scientific surface contract without pretending that a generic renderer surface is VDW, SAS, or SES. Each profile is renderer-neutral and has distinct parameters, cache identity, target/contributor semantics, and an explicit generator status.

| Profile | `profile_id` | Radius source | Probe radius | Occluders | Resolution / quality | Generator | Status |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| VDW | `surface.vdw.element-vdw.v1` | canonical element VDW radius | 0.0 Å | all canonical coordinate atoms | 0.5 / standard | not implemented in G1C | COMING_SOON |
| SAS | `surface.sas.element-vdw.probe-1.4A.v1` | canonical element VDW radius | 1.4 Å | all canonical coordinate atoms | 0.5 / standard | not implemented in G1C | COMING_SOON |
| SES | `surface.ses.element-vdw.probe-1.4A.v1` | canonical element VDW radius | 1.4 Å | all canonical coordinate atoms | 0.5 / standard | not implemented in G1C | COMING_SOON |

All profiles record `coordinate_state=active`, `target_atoms=style_target_atoms`, `contributor_atoms=target_plus_explicit_occluders`, a scientific-hash-aware cache key, and `color_source=atom_color_state`. SAS and SES remain distinct profiles even though both use a 1.4 Å probe here; their generators are not conflated. Mesh, Dots, and Dot Surface likewise remain Coming Soon until a governed generator and sampling contract exist.
