# Molexplorer user guide

Molexplorer opens the molecular workstation at `http://localhost:3101/molstudio`. The top menu is the primary route; the narrow rail at the far right opens one working panel inward while the command console stays collapsed until needed.

## Common workflow

1. Choose **File → Open/Import** and select an admitted coordinate file, or enter a four-character ID in the RCSB fetch control.
2. Use **Objects & Selections** to focus an object or toggle its visibility.
3. Use **Display**, **Color**, **Select**, **Measure**, **Analyze**, **Ligand**, **Edit**, or **Session** in the right rail.
4. Use **View → Fit**, **Center**, or **Orient** to restore the camera.
5. Open **Command Console** for advanced, semicolon-separated commands. `Esc` clears the active selection.

The **Movie** and **Settings** controls in the scientific rail are visibly disabled in this release because their implementation gates are not complete. The footer Theme and Settings icons carry the same disabled state; use the working Display, Color, View, and Session panels for current presentation and persistence controls.

Admitted coordinate formats are PDB, mmCIF/CIF, PQR, SDF/MOL, single-frame XYZ, one-molecule MOL2, and one-molecule PDBQT. Use **File → Import** for FASTA/FASTQ/GenBank/EMBL sequence data, DX/MRC/CCP4 maps, multi-frame XYZ or GRO trajectories, PSF/PRMTOP topology metadata, and SMILES notation. These sources open in dedicated typed viewers and are never rendered as invented coordinates. DCD, TRR, and XTC coordinate frames are decoded within bounded limits. Import a PSF or PRMTOP after a matching trajectory to attach atom names, residue labels, chain or segment identifiers, and topology counts; pairing is rejected when atom counts differ.

## Scientific limits

H-bond, contact, clash, and ligand proximity actions are bounded coordinate diagnostics. They do not produce docking poses, affinity scores, or unvalidated interaction classes. Exact PyMOL executable conformance is not claimed because no pinned PyMOL executable is available in this environment; see the conformance matrix.
