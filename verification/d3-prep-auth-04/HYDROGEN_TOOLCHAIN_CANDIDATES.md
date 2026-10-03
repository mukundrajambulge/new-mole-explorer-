# Hydrogen toolchain candidate review

## Selection

Propose RDKit 2026.03.6 as the sole hydrogen-coordinate generator for both the explicitly assembled receptor graph and the BNZ graph. It is suitable only when the input graph, formal charges, explicit state map, atom identities, and coordinates are already supplied. RDKit does not choose the receptor microstate, pH, histidine tautomer, altloc, water/component role, or missing structure. Those are fixed separately by the owner-approved profile.

This candidate is consistent with DEC04's no-minimization/no-repair proposal: use the documented AddHs operation with addCoords=True on a fully specified graph and existing conformer, and call no conformer generator, force field, minimizer, or repair tool. The exact profile contract is in PINNED_TOOLCHAIN_PROPOSAL.md. No candidate has been run on the 3DMX fixture.

## Candidate comparison

| Candidate | Exact source/version | Relevant capability | State, alternate and terminal behavior | Heavy-atom and provenance assessment | Decision |
|---|---|---|---|---|---|
| RDKit | 2026.03.6 stable release; tag Release_2026_03_6 resolves to commit 0e0d85f4ca34aeae15dfc0f7cf5503bdb0a8e985; Windows CPython 3.13 wheel SHA-256 is 3765896e189a5dc4ef109a1ab81c375fb1e00185d52374ffc2128391bddd6b8f. [Release](https://github.com/rdkit/rdkit/releases/tag/Release_2026_03_6), [AddHs API](https://rdkit.org/docs/source/rdkit.Chem.rdmolops.html), [source implementation](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/AddHs.cpp) | Adds H atoms to a supplied chemical graph; AddHsParameters exposes addCoords and addResidueInfo, and the API returns an H-added copy. Protein and ligand graphs are supported when their bonds/charges/states are explicitly supplied. | It does not assign pH/protonation. Explicit state and graph are caller inputs. It does not choose alternate conformers or termini. The adapter must pass only the approved blank+A heavy graph, explicit termini and residue formal states. AddHs computes coordinates from the existing conformer; no automatic minimization or pKa step is called. | Heavy atom mapping can be carried by stable map numbers/AtomPDBResidueInfo and then independently compared. AddHs source appends H atoms and computes their coordinates without an optimizer or RNG call. The adapter must preserve AtomUID parent relations, explicit H IDs, exact input coordinates, tool/version/profile, and output F64 bits. It does not itself parse the deposited CIF or supply a correct protein graph. | **Selected candidate**, conditional on exact graph/state preflight and postcondition validation. |
| OpenMM | 8.6.1; tag commit b399af4725573963b46d6c1083fdcf7a37615857; CPython 3.13 Windows x64 wheel SHA-256 fe4d1acfb0278c9591f1f4c247b1b7d3d236b49e7a7d6d464e1c547f406d8af9. [Release](https://github.com/openmm/openmm/releases/tag/8.6.1), [Modeller source](https://github.com/openmm/openmm/blob/8.6.1/wrappers/python/openmm/app/modeller.py), [PDBxFile source](https://github.com/openmm/openmm/blob/8.6.1/wrappers/python/openmm/app/pdbxfile.py) | Strong protein hydrogen support; accepts pH, explicit variants including HID/HIE/HIP/HIN and ASP/ASH/GLU/GLH/LYS/LYN, and permits specifying a platform. Ligand BNZ would require explicit hydrogen definitions/graph support beyond normal protein templates. | If variants are omitted, it chooses common ionization states and chooses neutral histidine tautomer by hydrogen bonding. Passing pH/variants can control states, but pH-dependent defaults remain for any None entries. PDBxFile's duplicate atom handling keeps the first alternate encountered, so explicit upstream A-only filtering is needed. | Modeller.addHydrogens copies existing atom coordinates and sets all pre-existing masses to zero during its local minimization, so it can immobilize heavy atoms. However, the API always performs a local hydrogen minimization, including forcefield=None. That violates DEC04's strict no-minimization proposal. Therefore not selected. OpenMM application/reference and CPU platforms are MIT; GPU platforms have LGPL terms; the candidate would use Reference only. [License](https://docs.openmm.org/latest/userguide/library/01_introduction.html) |
| Meeko | 0.8.0, the exact version in the active D3-DEC-02 owner record. [Owner registration](https://docs.google.com/document/d/16tF0edL-qg1QYvYC8m3GcnJVrI_X2SS3VSGxNPRjljA/edit) | Relevant as the project's prior Vina-compatible conversion/preparation reference. | The owner record expressly limits it to experimental/reference evidence and does not designate it as the production preparer. This AUTH04 task must not promote it or rely on it to choose chemical states. | Its use would add a separate conversion/atom-typing path and does not satisfy the currently recorded project authority restriction. A new owner decision would be needed to change that status. | Not eligible as the selected production or candidate preparation toolchain under current authority. |

## Why the selected operation is hydrogen-only

RDKit AddHs is not a preparation pipeline by itself. It adds hydrogens to an existing graph. The proposed driver must first build and validate a complete heavy-atom graph from the exact source atom records, CCD component bond tables, polymer connectivity evidence, and the approved formal-state map. A graph/valence mismatch, unresolved connection, missing heavy atom, extra atom, or ambiguous state is a hard error. No RDKit PDB bond perception, automatic sanitization state change, tautomer enumeration, hydrogen removal, geometry embedding, MMFF/UFF optimization, or receptor repair is allowed.

The RDKit C++ AddHs implementation copies the input molecule for its copy-returning Python API, appends H atoms and, when addCoords=True, computes H coordinates from the conformer. It does not call a force field or optimizer. The selected build's exact commit and wheel are pinned above and again in PINNED_TOOLCHAIN_PROPOSAL.md. Existing heavy coordinates must still be checked bit-for-bit; API behavior is not a substitute for the heavy-atom invariant.

## Determinism, mapping, and access

For fixed input atom/bond order, exact binary64 conformer coordinates, explicit formal-state graph, RDKit build, and AddHsParameters, the selected AddHs operation is deterministic and uses no random seed. The run records RDKit version and build, graph order/hash, parameter values, all output atom identities and hydrogen parent UIDs, coordinate bits, and file digests. The input adapter and profile/config bytes are sealed before the first AddHs call.

RDKit is publicly accessible under BSD-3-Clause. Python is available from python.org under the PSF license. The pinned binary wheels are downloadable from PyPI; the exact artifacts and hashes are listed in PINNED_TOOLCHAIN_PROPOSAL.md. The inspected PyPI records do not show Trusted Publishing for these release uploads, so hashes establish artifact identity after acquisition but are not a source-reproducible build claim. The toolchain requires internet only to acquire the exact official installer/wheels; the molecular run itself is offline and does not contact a service.

## Capability boundary

- Protein H support: yes, on a correct complete protein graph and explicitly assigned residue states; no missing atom/residue repair.
- BNZ H support: yes, on the six-atom CCD aromatic graph and deposited conformer; one mapped H per carbon.
- Protonation/pKa: no automatic selection; owner-approved state map is input.
- Histidine: one HIS31, explicitly set to HID in the graph; no automatic tautomer decision.
- Alternates: no selection; adapter filters to source common atoms plus approved A alternatives and validates the retained set.
- Termini: no inference from coordinate truncation; profile supplies the Met1 and Leu164 polymer-terminal states and validates topology.
- Heavy atoms: no permitted operation modifies them; runtime bitwise check plus final serialization check required.
- Repair/minimization/flip: none; the driver must not call any such operation.
- Mapping/provenance: supported through stable heavy atom map numbers and residue information plus an explicit hydrogen-to-parent record. A generated H that cannot be attached to one exact parent AtomUID blocks the run.

## Primary references

- [RDKit 2026.03.6 release](https://github.com/rdkit/rdkit/releases/tag/Release_2026_03_6)
- [RDKit AddHs API](https://rdkit.org/docs/source/rdkit.Chem.rdmolops.html)
- [RDKit AddHs source at the pinned tag](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/Code/GraphMol/AddHs.cpp)
- [RDKit BSD license](https://github.com/rdkit/rdkit/blob/Release_2026_03_6/license.txt)
- [OpenMM 8.6.1 release](https://github.com/openmm/openmm/releases/tag/8.6.1)
- [OpenMM 8.6.1 Modeller source](https://github.com/openmm/openmm/blob/8.6.1/wrappers/python/openmm/app/modeller.py)
- [OpenMM 8.6.1 PDBxFile source](https://github.com/openmm/openmm/blob/8.6.1/wrappers/python/openmm/app/pdbxfile.py)
- [OpenMM license description](https://docs.openmm.org/latest/userguide/library/01_introduction.html)

## Pinned Python API signature correction

The RDKit 2026.03.6 Python wrapper is called with explicit boolean keyword arguments, not by passing an `AddHsParameters` object. Its internal C++ parameter struct defaults `skipQueries` to false. The approved adapter must first reject query atoms and query bonds, then use the exact call in `PINNED_TOOLCHAIN_PROPOSAL.md`. This changes only call syntax; it does not change the pinned software, effective flags, state, or scientific interpretation. Primary source verification is recorded in `TOOLCHAIN_API_VERIFICATION.md`.
