# SearchRegion fixture policy

The proposed case is a frozen crystal-pose scoring evaluation. It is not a pose search or global docking experiment. No search box or numerical bounds were created in this lane.

A future fixture must use one exact SearchRegion object with explicit coordinate frame, inclusive/exclusive boundary semantics as defined by the controlling contract, coordinate bounds, interpolation halo, grid spacing/profile, and canonical digest. Bounds must be derived only after the exact accepted receptor/ligand states and the current D3-GRID-01 domain/grid profile are resolved. Do not invent dimensions from the source pose or reuse a global search box by default.

Any bounded fixture region must cover the fixed ligand pose plus the approved interpolation support margin and must satisfy the current grid implementation's domain contract. The same region digest and frozen coordinates must be supplied to direct and grid scoring. Record it as development-only and do not tune its size to produce a desired score agreement.

The current candidate is scientifically inadmissible, so no AABB, halo, grid fixture, or SearchRegion digest is proposed. DEC-13 remains pending.