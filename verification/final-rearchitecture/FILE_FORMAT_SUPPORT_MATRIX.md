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
| SMILES | Not admitted | No 3D coordinates are fabricated from a line notation | Planned chemistry adapter |
| FASTA/FASTQ/GenBank/EMBL | Not admitted yet | No coordinates are fabricated | Planned sequence adapters |
| MRC/CCP4/DX | Not admitted yet | No density/map rendering claim | Planned map adapters |
| Trajectories | Not admitted yet | No trajectory support claim | Research-only pending corpus and performance gate |

The UI lists only admitted coordinate formats. Unsupported formats continue to fail closed at the import boundary.
