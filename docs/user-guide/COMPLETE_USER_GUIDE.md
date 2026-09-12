# Molexplorer user guide

Molexplorer opens the molecular workstation at `http://localhost:3101/molstudio`. The top menu is the primary route; the narrow rail at the far right opens one working panel inward while the command console stays collapsed until needed.

## Common workflow

1. Choose **File → Open/Import** and select an admitted coordinate file, or enter a four-character ID in the RCSB fetch control.
2. Use **Objects & Selections** to focus an object or toggle its visibility.
3. Use **Display**, **Color**, **Select**, **Measure**, **Analyze**, **Ligand**, **Edit**, or **Session** in the right rail.
4. Use **View → Fit**, **Center**, or **Orient** to restore the camera.
5. Open **Command Console** for advanced, semicolon-separated commands. `Esc` clears the active selection.

Admitted coordinate formats are PDB, mmCIF/CIF, PQR, SDF/MOL, single-frame XYZ, one-molecule MOL2, and one-molecule PDBQT. FASTA/FASTQ, maps, and trajectories are deliberately not rendered as coordinates.

## Scientific limits

H-bond, contact, clash, and ligand proximity actions are bounded coordinate diagnostics. They do not produce docking poses, affinity scores, or unvalidated interaction classes. Exact PyMOL executable conformance is not claimed because no pinned PyMOL executable is available in this environment; see the conformance matrix.
