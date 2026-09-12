# Slice F — Select rail and canonical deselection

The Select rail now shows the current canonical selection state and provides `Select all` and `Clear selection`. It does not maintain its own selection data: `Select all` dispatches the established `SELECTION.EVALUATE` action, while clearing uses the same application handler as console `unpick`.

Escape now clears the active selection as well as cancelling an in-progress measurement. Clicking an empty canvas area uses that same clear-selection handler. Persistent molecular objects, representations, colors, and completed measurement objects are not changed by this workflow.

`AT-FSR-F-001` imports a local protein, selects all atoms from the rail, clears with the rail button, then repeats selection and clears it with Escape. The visual evidence is `evidence/SLICE_F_SELECT_RAIL.png`.
