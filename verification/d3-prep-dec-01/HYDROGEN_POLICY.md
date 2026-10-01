# Hydrogen policy

No hydrogens were added in this lane. The deposited structure is retained byte-for-byte as source evidence. Added hydrogen atoms would be derived state and would require explicit parent-atom mapping, generation method, orientation rule, residue chemical state, and provenance.

## Proposed controlled policy

- Decide residue protonation and histidine tautomer states first; hydrogen generation cannot be used to hide unresolved chemistry.
- Define hydrogen placement/orientation, handling of hydroxyls and terminal groups, and deterministic treatment of equivalent hydrogens.
- Require a future tool to preserve every accepted source heavy atom's identity and coordinates exactly. Reject unexpected heavy-atom additions, deletions, renames, repairs, or movement.
- Record generated atom identities, parent mappings, coordinates, software version, settings, seed if applicable, and output digest in the prepared state.
- Validate generated hydrogens for completeness and chemical connectivity using a fixed, reviewed rule set.
- Fail closed if the tool performs undocumented optimization, repairs missing heavy atoms, changes source coordinates, or gives non-reproducible orientations.

D3-RA-01 reports PDB2PQR 3.7.1 candidate behavior includes automatic debump/H optimization by default; --noopt still permits water-only optimization. This is not evidence that the tool has been selected or that its output meets this policy. No PDB2PQR, PROPKA, or other molecular-state operation ran in this lane. DEC-07 is pending.