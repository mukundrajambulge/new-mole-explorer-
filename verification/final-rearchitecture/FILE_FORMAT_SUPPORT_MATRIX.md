# File-format support matrix

| Format family | Current handling | Scientific claim | Evidence |
| --- | --- | --- | --- |
| PDB | 3D object | Coordinates, PDB topology where supplied, states, crystallographic records | Existing ingestion acceptance suite |
| mmCIF/CIF | 3D object | Coordinates, atom-site identity, parsed source annotations, states | Existing ingestion acceptance suite |
| PQR | 3D object | Coordinates and complete source charge field; PQR radii are validated but do not replace the application's VDW model | `AT-FSR-B-001`, `ingestion.test.ts` |
| SDF/MOL | One V2000 molecule as 3D object | Coordinates and declared V2000 bond orders; multi-record SDF fails closed | `AT-FSR-B-002`, `ingestion.test.ts` |
| XYZ | One coordinate frame as 3D object | Source-declared elements and Cartesian coordinates; XYZ does not declare bonds, so no bond inference is claimed; additional frames fail closed | `AT-FSR-G-001`, `ingestion.test.ts` |
| MOL2 | One SYBYL molecule as 3D object | Cartesian coordinates, declared MOL2 bond types, and complete source atom charges when present; multi-molecule files fail closed | `ingestion.test.ts` |
| PDBQT | One docking coordinate object | PDBQT coordinates and source partial charges; no bond inference is claimed because PDBQT does not carry authoritative connectivity | `ingestion.test.ts` |
| SMILES | Typed notation viewer | Records and names are preserved; no 3D coordinates are fabricated from line notation | `adapters.test.ts`, `AT-FSR-J-001` paste path |
| FASTA | Sequence viewer | Multi-record sequence, alphabet, descriptions, search, and bounded character rendering | `adapters.test.ts`, `AT-FSR-J-002` |
| FASTQ | Sequence + quality viewer | Sequence and Phred+33 quality are validated and shown separately; no coordinates are fabricated | `adapters.test.ts`, `AT-FSR-J-003` |
| GenBank / EMBL | Sequence viewer | ORIGIN/SQ sequence extraction with source identifiers; no coordinates are fabricated | `adapters.test.ts`, `AT-FSR-J-001` |
| OpenDX (DX) | Density-map viewer | Grid counts, origin, spacing, values, completeness, slice control, and range statistics | `adapters.test.ts`, `AT-FSR-J-004` |
| MRC / CCP4 | Density-map viewer | Binary header, supported scalar modes, voxel payload, spacing, and range statistics are decoded within bounded limits | `adapters.test.ts` binary fixture |
| XYZ trajectory | Trajectory viewer | Multi-frame XYZ is validated with constant atom count and frame slider; single-frame XYZ remains a coordinate object | `adapters.test.ts`, `AT-FSR-J-005` |
| GRO | Trajectory viewer | One coordinate frame is parsed with nm→Å conversion; topology is not inferred | `adapters.test.ts` |
| DCD | Decoded trajectory frames | Fortran records, frame count, atom count, float32/float64 coordinates, and bounded frame slider; fixed-atom reconstruction is rejected explicitly | `adapters.test.ts`, `AT-FSR-J-008` |
| XTC | Decoded trajectory frames | Big-endian XTC headers, small uncompressed frames, GROMACS compressed coordinate blocks, bounded frame slider, and Å viewer conversion | `adapters.test.ts`, `AT-FSR-J-010` |
| TRR | Decoded trajectory frames | Big-endian frame headers, float32/float64 coordinate blocks, constant atom count, and bounded frame slider | `adapters.test.ts`, `AT-FSR-J-009` |
| PSF / PRMTOP | Topology metadata viewer | Atom/bond/residue metadata is shown separately; no coordinate rendering is claimed | `adapters.test.ts` |

The File → Import dialog lists coordinate and biological adapters separately and offers Local file, Online ID, and Paste / text routes. Unsupported or malformed sources fail closed at the import boundary. Online RCSB IDs use the existing canonical structure ingestion; PubChem returns typed SMILES and UniProt returns typed FASTA.
