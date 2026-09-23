# Slice H — Real multi-object workspace

`AT-FSR-H-001` uses real RCSB mmCIF acquisitions for 4DJW and 1CRN. It verifies that adding 1CRN preserves 4DJW as a separate enabled workspace object and installs two renderer models. The Display rail `Fit` action targets both visible objects while the console stays collapsed for the visual gate.

The test then independently hides 4DJW, restores it while hiding 1CRN, and restores both. The visual evidence set is:

- `evidence/SLICE_H_4DJW_LOADED.png`
- `evidence/SLICE_H_BOTH_VISIBLE_FIT_ALL.png`
- `evidence/SLICE_H_4DJW_HIDDEN.png`
- `evidence/SLICE_H_1CRN_HIDDEN.png`
- `evidence/SLICE_H_BOTH_VISIBLE_RESTORED.png`

The test also confirms that object-qualified console selection continues to address 4DJW after the add workflow. A local two-object fixture run (`AT-FSR-H-000`) provides an independent renderer transition check.
