# Receptor chemical-state policy

## Current evidence

The reported crystallization mother liquor was pH 6.7 with 2.3 M phosphate and 0.23 M NaCl; crystals were equilibrated with ligand for 3–10 days before data collection. This is a bulk preparation condition. It is not a direct measurement of crystal-internal pH, local dielectric environment, residue-specific pKa, or protonation microstate. Do not substitute a generic neutral-pH default.

No receptor protonation or histidine state has been selected or calculated in this gate. No PROPKA or PDB2PQR run was performed. Candidate versions previously researched are methods evidence only. PHD-V2-03 requires an explicit receptor identity and chemical state; D3-RA-01 likewise stops before selecting a state.

## Proposed policy for owner and reviewer consideration

1. Record pH 6.7 only as the experiment-specific bulk target with its source and limitations.
2. Enumerate all titratable residues, termini, histidines, and relevant nearby groups in the exact accepted construct and assembly before choosing a chemical state.
3. Provide a residue-level state table with atom names, protonation/tautomer choice, evidence, method and version, settings, and reviewer disposition. Histidine state must be explicit.
4. Treat any prediction tool output as evidence to review, not as automatic authority. Report uncertainty and alternatives where the environment does not distinguish a state.
5. Preserve the source heavy-atom identity and coordinates exactly. Any future state generation that adds atoms must prove heavy-atom names, mapping, coordinates, and counts are unchanged.
6. Fail closed if construct termini or a materially relevant microstate cannot be resolved under the accepted scientific policy.

No numeric pH choice, residue-state assignment, or preparation method is approved here. DEC-05 and DEC-06 are pending owner decisions and independent review.