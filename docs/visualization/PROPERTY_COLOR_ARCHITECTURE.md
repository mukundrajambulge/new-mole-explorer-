# G1C property-color architecture

Property-dependent color is valid only when the property is part of the canonical molecular revision or an explicitly attached dataset with matching `molecularRevision`.

| Scheme | Scientific property | Source / units | Profile and normalization | Missing-data behavior | Status |
| --- | --- | --- | --- | --- | --- |
| Formal Charge | formal charge, including exact zero | `CanonicalAtom.formalCharge`, charge units | signed diverging blue-white-red, [-3,+3] | unknown is retained as absent/null and emits `FORMAL_CHARGE_UNKNOWN`; it is never converted to zero | SUPPORTED_WITH_LIMITATIONS |
| Partial Charge | atom partial charge | `PartialChargeDataset.atomChargeMap`, declared dataset units (fixture uses e) | dataset absolute-max normalization, blue-white-red | exact diagnostic `Partial-charge data unavailable for this molecular revision.` | SUPPORTED_WITH_LIMITATIONS |
| Hydrophobicity | residue hydrophobicity score | canonical residue identity; Kyte-Doolittle 1982 scale | reproducible score range [-4.5,+4.5], blue-white-orange | unknown residue remains neutral with a diagnostic | SUPPORTED_WITH_LIMITATIONS |
| Secondary Structure | HELIX/SHEET/LOOP assignment | imported PDB HELIX/SHEET or mmCIF struct records, `SecondaryStructureDataset` | same assignment, separate Standard and Jmol palettes | `Secondary-structure assignment unavailable for this molecular revision.` | SUPPORTED_WITH_LIMITATIONS |
| ESP | electrostatic potential field | a future registered field engine with charge source, dielectric, units, cutoff, surface, and normalization | potential-field sampling only | `ESP field unavailable: no electrostatic potential computation is registered for this molecular revision.`; no red/blue charge substitute | EXPERIMENTAL |

B-factor is also canonical source data for the Putty representation, not a color shortcut. Source parser values are optional and preserve unknown state. Color, representation, visibility, background, camera, and panel changes do not change `scientificHash`, atom identities, bonds, coordinates, provenance, or revision.
