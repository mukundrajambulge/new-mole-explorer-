# Locked subsystem index

All records below are tied to SHA `77b4b6b` and were created after the
corresponding functional, scientific, visual, and regression checks.

| Subsystem | Lock record | Gate |
| --- | --- | --- |
| Foundation shell | `FOUNDATION.lock.json` | A: shell, rail, console, status bar |
| Import | `IMPORT_LOCK.json` | B/J: coordinate and typed biological imports |
| Object model | `OBJECT_MODEL_LOCK.json` | B/H: multi-object and state ownership |
| Selection | `SELECTION_LOCK.json` | C/F: grammar, membership, clear, overlay |
| Display | `DISPLAY_LOCK.json` | D: representations and visibility |
| Color | `COLOR_LOCK.json` | D: scoped color and schemes |
| Measurement | `MEASURE_LOCK.json` | E: distance, angle, dihedral |
| Ligand | `LIGAND_LOCK.json` | I: contextual ligand diagnostics |
| Analysis | `ANALYZE_LOCK.json` | D/R08: structural analysis and fitting |
| Session | `SESSION_LOCK.json` | R09: sessions and scenes |
| Console | `CONSOLE_LOCK.json` | C/R10: safe tokenized dispatch |
| Documentation | `DOCUMENTATION_LOCK.json` | User-guide and inventory coverage |

The consolidated bounded records (`DATA_OBJECTS.lock.json`,
`LIGAND_CONTEXT.lock.json`, and `RELEASE_EVIDENCE.lock.json`) remain the
evidence summaries for the corresponding groups. Any future change to a locked
subsystem must reopen its record, rerun its gate, and create a new SHA-bound
record.
