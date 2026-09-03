# Pinned PyMOL object-identity evidence

This note records the native object-name behavior used to classify the application's duplicate-display-name policy.

- Source: `schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`
- Source location: `layer3/Executive.cpp`, lines 4133–4144 and 14810–14821 in the pinned checkout.

The pinned source resolves an existing object by name before loading (`ExecutiveGetExistingCompatible`). When an object with the same name is already present, the executive object registry finds the matching record and deletes the prior object before installing the new one. Native PyMOL therefore has a name-unique object namespace; it does not expose a duplicate-display-name selection case with two independent objects.

Mole Explorer intentionally keeps durable `ObjectID` separate from mutable display name so multiple loaded objects can coexist. A bare ambiguous display name is rejected with no state change, while an explicit durable `ObjectID` selects exactly one object. This is a documented application identity-safety extension equivalent to the native name-unique rule, not a claim that PyMOL has duplicate-name membership semantics.

The live duplicate-name E2E covers both sides of this policy: the ambiguous display name is rejected, and the explicit durable `ObjectID` selects the expected 12 atoms.
