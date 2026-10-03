# RDKit hydrogen API pin verification

## Pinned evidence

- Release: RDKit 2026.03.6, tag `Release_2026_03_6`, commit `0e0d85f4ca34aeae15dfc0f7cf5503bdb0a8e985`.
- Windows wheel: `rdkit-2026.3.6-cp313-cp313-win_amd64.whl`; SHA-256 `3765896e189a5dc4ef109a1ab81c375fb1e00185d52374ffc2128391bddd6b8f`.
- Official versioned Python API docs list `rdkit.Chem.rdmolops.AddHsParameters` and its `explicitOnly`, `addCoords`, `addResidueInfo`, and `skipQueries` fields.
- The pinned release Python wrapper's `addHs` callable takes a molecule and boolean arguments `explicitOnly`, `addCoords`, `onlyOnAtoms`, and `addResidueInfo`. Its implementation constructs the internal parameter struct from those arguments. Passing an `AddHsParameters` object as the second Python argument is not the pinned wrapper signature.
- The internal C++ `AddHsParameters::skipQueries` member defaults to `false`. The proposed input graph must contain no query atoms or query bonds, so `skipQueries=False` is both the approved value and behaviorally irrelevant after that preflight.
- `AddHs.cpp` adds hydrogen atoms and coordinates to a copied molecule for the Python copy-returning API; it contains no force-field/minimization call. The API itself does not replace the required runtime comparison of all heavy-atom identities and coordinate bits.

Primary sources:

- [RDKit 2026.03.6 Python AddHs API](https://rdkit.org/docs/source/rdkit.Chem.rdmolops.html)
- [Pinned release Python wrapper, `MolOps.cpp`](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/Wrap/MolOps.cpp#L2723-L2752)
- [Pinned release hydrogen implementation, `AddHs.cpp`](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/AddHs.cpp#L3144-L3245)
- [Pinned RDKit release](https://github.com/rdkit/rdkit/releases/tag/Release_2026_03_6)
- [Exact PyPI wheel file and SHA-256](https://pypi.org/project/rdkit/2026.3.6/)

## Approved effective Python call

The proposal's initial `Chem.AddHs(molecule, params)` syntax was corrected to the exact Python wrapper interface without changing the approved tool, version, state or effective flags:

```python
added = Chem.AddHs(
    molecule,
    explicitOnly=False,
    addCoords=True,
    onlyOnAtoms=None,
    addResidueInfo=True,
)
```

`skipQueries=False` is the pinned internal default. The driver must verify that no input atom or bond is a query; any query causes a pre-operation stop. The API-only correction is not a chemical-state decision or profile substitution.

## Verification limit

This AUTH04 decision task performed source/API and release/hash verification only. It did not import RDKit, call AddHs on any molecular structure, or prepare 3DMX/BNZ. The exact Python installer was downloaded and its SHA-256 matched the Python release page. A per-user isolated installer attempt returned Windows Installer error `0x80070003` while opening the local `core.msi` cache path; it rolled back, installed no Python runtime, and performed no chemical operation. The future execution task must verify runtime and wheel installation from the exact hashes before it can proceed.