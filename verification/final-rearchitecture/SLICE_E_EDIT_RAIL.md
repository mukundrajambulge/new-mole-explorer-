# Slice E — Canonical Edit rail

The Edit button in the permanent right-side scientific rail now opens the established topology-editing actions: atom deletion, bond creation and removal, hydrogen operations, atom attachment and replacement, bond-order changes, and history undo/redo.

The controls delegate to the same canonical action IDs and bond-order handler used by the existing command/action layer. The obsolete hidden Edit branch was removed from the top contextual toolbar, leaving one visible GUI route for scientific editing.

`AT-FSR-E-001` imports a local protein, verifies the rail starts in a safe no-selection state, creates a canonical console selection, then verifies that selection-dependent edit operations become available while two-atom-only operations remain disabled. The evidence image is `evidence/SLICE_E_EDIT_RAIL.png`.

During visual inspection, the selected polymer atoms were shown as full spheres under a cartoon representation. The selection overlay now uses sticks for polymer selections, with the existing bounded halo reserved for a single selected atom; canonical coordinates and atom radii remain unchanged.
