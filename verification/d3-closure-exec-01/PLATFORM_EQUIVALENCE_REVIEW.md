# Platform equivalence review

**Decision:** PASS for the bounded hydrogen-addition operation, subject to the runtime and source hashes recorded here and the per-run invariants/replay checks. This review does not claim Windows/Linux binary or generated-H-coordinate identity.

## Same approved operation

- Both artifacts are the official PyPI RDKit `2026.3.6` CPython 3.13 x86-64 wheel for their respective platform. The Windows wheel SHA-256 remains `3765896e189a5dc4ef109a1ab81c375fb1e00185d52374ffc2128391bddd6b8f`. The selected Linux artifact is `rdkit-2026.3.6-cp313-cp313-manylinux_2_28_x86_64.whl`, SHA-256 `3d0a2011c2a46f312010c8d8ec89b8210795663285545b2ac0909d1b9551fe41`.
- The Linux wheel is the PyPI `rdkit` distribution artifact; its embedded metadata identifies the wheel packaging project as `kuelumbus/rdkit-pypi` (Christopher Kuenneth). PyPI's file hash was verified independently against the downloaded wheel. The Linux wheel is not described as an RDKit-upstream-signed binary. Upstream source/API semantics are verified separately against the exact upstream tag/commit below.
- Both identify RDKit release `2026.03.6`, source tag `Release_2026_03_6`, commit `0e0d85f4ca34aeae15dfc0f7cf5503bdb0a8e985`. The Linux runtime independently reports package metadata `2026.3.6` and `rdBase.rdkitVersion == 2026.03.6`.
- At that exact source tag, the Python wrapper `addHs(orig, explicitOnly, addCoords, onlyOnAtoms, addResidueInfo)` initializes `AddHsParameters` from the same three booleans and passes the optional atom list separately (`Code/GraphMol/Wrap/MolOps.cpp`, lines 2725–2752). The pinned C++ struct sets `skipQueries = false` by default (`Code/GraphMol/MolOps.h`, lines 168–174). The Python wrapper does not accept an `AddHsParameters` object as its second positional argument.
- The approved effective call remains:

  ```python
  Chem.AddHs(molecule, explicitOnly=False, addCoords=True,
             onlyOnAtoms=None, addResidueInfo=True)
  ```

- The pinned implementation appends hydrogen atoms and obtains their coordinates through `setTerminalAtomCoords`; it does not invoke conformer generation or a force-field/minimization routine (`Code/GraphMol/AddHs.cpp`, lines 3250–3324; `MolOps.h`, lines 188–215). Input query atoms and query bonds are rejected before the call, making `skipQueries=False` behaviorally irrelevant for approved graphs.
- The Linux safe synthetic control successfully imported the exact API and passed twice with identical canonical output and digest. The query-atom and query-bond guard checks both rejected their input. Heavy atom coordinates and bonds were unchanged; only the expected synthetic ethane hydrogens were added.
- A separate synthetic aromatic six-carbon control also passed in two fresh processes with bitwise-identical signatures and exactly one parented hydrogen per carbon. It used no fixture files.

## Scope and limits

The Linux wheel is a different platform binary and has its own recorded SHA-256 and extension hashes. No claim is made that platform-specific floating-point implementations generate bitwise-identical hydrogen coordinates across Windows and Linux. The authorized scientific contract requires unchanged source heavy-atom coordinate bits and deterministic replay in the chosen Linux environment; the fixture will record both replay digests. The source input byte hashes must match across Windows and WSL immediately before parsing. The approved chemical graph/state and API arguments are unchanged.

This review covers the bounded runtime/API relocation and synthetic operation only. The exact source hash-gated CIF preflight later discovered additional unresolved A/B states at ASN68, ASP72, and ARG76. The frozen profile does not resolve these groups, so no fixture-derived molecule was supplied to RDKit and no fixture `AddHs` operation is authorized under the current profile. See `SOURCE_PROFILE_MISMATCH.md`.

## Primary pinned sources

- [Pinned RDKit Python wrapper, `MolOps.cpp`](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/Wrap/MolOps.cpp#L2725-L2752)
- [Pinned RDKit `AddHsParameters` and wrapper contract, `MolOps.h`](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/MolOps.h#L168-L215)
- [Pinned hydrogen implementation, `AddHs.cpp`](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/AddHs.cpp#L3250-L3342)
- [Pinned RDKit release tag](https://github.com/rdkit/rdkit/releases/tag/Release_2026_03_6)
- [Official PyPI RDKit 2026.3.6 artifacts](https://pypi.org/project/rdkit/2026.3.6/)
