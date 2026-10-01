# Component-retention policy

## Source inventory

The prior D3-IR-01 inventory reports 136 waters, one HED component, and two chloride ions in the source entry. None was reported within 8 Å of the BNZ pose. This is a geometric screen around the observed pose, not proof that a component is biologically irrelevant, absent from the crystal environment, or unable to influence a modeled receptor state. The exact frozen mmCIF includes the source component records and remains unchanged.

The source assembly record calls assembly 1 monomeric and its assembly generator lists asym IDs A–F. A future receptor state must bind to a specific component and assembly decision; “monomeric” does not by itself define whether HED, ions, waters, or other asym IDs are retained.

## Proposed policy for review

- Preserve all original component records in the source artifact and provenance.
- Make a component-by-component disposition for protein chains, waters, HED, chloride, and any other non-polymer entities, including rationale and source identifiers.
- A dry derivative that omits water, HED, and chloride may be considered only after owner and independent scientific approval, with exact excluded atom/entity lists and a reproducible transformation record.
- No bulk deletion rule is approved here. No waters or ions are automatically added, retained, or removed.
- A water-mediated or mobile-water docking claim is outside this fixture's current scope. Any future retained water must have a defined coordinate, occupancy, identity, and interaction policy.
- Fail closed if component identity, assembly membership, or an omitted component could change the interpretation of the narrow case.

DEC-08 is pending. Source components were neither edited nor prepared in this lane.