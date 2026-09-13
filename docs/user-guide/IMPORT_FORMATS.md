# Import formats

Use **File → Import** for the unified biological-data flow. The dialog has three source tabs:

- **Local file** reads an admitted file from disk.
- **Online ID** fetches an explicit RCSB PDB ID, PubChem compound name, or UniProt accession.
- **Paste / text** validates pasted FASTA, FASTQ, GenBank, EMBL, DX, SMILES, XYZ trajectory, GRO, PSF, or PRMTOP text.

Coordinate files (PDB, mmCIF/CIF, PQR, SDF/MOL, single-frame XYZ, MOL2, and PDBQT) continue through the canonical molecular ingestion path. Biological sources stay typed: FASTA/FASTQ/GenBank/EMBL open in the sequence viewer, DX/MRC/CCP4 open in the density-map viewer, multi-frame XYZ and GRO open in the trajectory viewer, PSF/PRMTOP open in the topology viewer, and SMILES opens in the notation viewer. No sequence or notation is converted into invented coordinates.

DCD, TRR, and XTC are admitted with bounded binary frame decoding and open in the ready trajectory viewer. DCD fixed-atom reconstruction is rejected explicitly. XTC supports both small uncompressed frames and GROMACS compressed coordinate blocks; malformed files fail closed and leave the current dataset unchanged.
