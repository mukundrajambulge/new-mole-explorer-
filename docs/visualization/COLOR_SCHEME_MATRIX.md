# G1C color scheme capability matrix

Color resolution is renderer-neutral: canonical properties → `ColorSchemeDefinition` → `ColorState` → `RenderProjection` → 3Dmol `colorfunc`. The 188-entry named-color registry is generated from the pinned PyMOL Open Source profile recorded in `colorRegistry.ts`; it is not a hand-maintained approximation.

| UI scheme | Source | Normalization / palette | Missing data | Status |
| --- | --- | --- | --- | --- |
| Classic CPK | `CanonicalAtom.element` | versioned CPK lookup | neutral grey for unknown element | SUPPORTED |
| Modern/Jmol | `CanonicalAtom.element` | distinct versioned Jmol lookup | neutral grey for unknown element | SUPPORTED |
| By Molecule | stable `CanonicalMolecularStructure.id` | deterministic categorical hash | ID is required | SUPPORTED |
| By Formal Charge | `CanonicalAtom.formalCharge` | signed blue-white-red, [-3,+3] | `FORMAL_CHARGE_UNKNOWN`; zero remains zero | SUPPORTED_WITH_LIMITATIONS |
| By Partial Charge | `PartialChargeDataset.atomChargeMap` | dataset absolute max, blue-white-red | `Partial-charge data unavailable for this molecular revision.` | SUPPORTED_WITH_LIMITATIONS |
| ESP | registered potential field | declared field model required | experimental unavailable diagnostic; never charge-color fallback | EXPERIMENTAL |
| Hydrophobicity | canonical residue name | Kyte-Doolittle 1982, [-4.5,+4.5] | explicit unknown-residue neutral | SUPPORTED_WITH_LIMITATIONS |
| Rainbow | canonical chain residue order | deterministic ordered ordinal, ROYGBIV | non-polymer stable neutral | SUPPORTED |
| Monochrome | presentation color | explicit `#d7e0ea` or custom | none | SUPPORTED |
| Colourblind-safe | stable chain/object identity | versioned Okabe-Ito palette | stable hash fallback | SUPPORTED |
| Secondary Structure (Standard) | imported `SecondaryStructureDataset` | standard HELIX/SHEET/LOOP palette | assignment-unavailable diagnostic | SUPPORTED_WITH_LIMITATIONS |
| Secondary Structure (Jmol) | same imported assignment | distinct Jmol HELIX/SHEET/LOOP palette | assignment-unavailable diagnostic | SUPPORTED_WITH_LIMITATIONS |
| By Chain | canonical chain ID | deterministic HSL categorical | neutral for missing chain | SUPPORTED |
| By Element (CPK) | `CanonicalAtom.element` | admitted CPK profile | neutral grey for unknown element | SUPPORTED |
| White | presentation constant | `#ffffff` | none | SUPPORTED |

Color survives visibility changes, representation changes, and adapter rebuilds because it is stored in `RenderProjection`. Explicit named/custom colors are resolved through `ColorRegistry`; unknown names produce `COLOR_NOT_FOUND` at the registry boundary.
