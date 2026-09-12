# File-format support matrix

| Format family | Current handling | Scientific claim | Evidence |
| --- | --- | --- | --- |
| PDB | 3D object | Coordinates, PDB topology where supplied, states, crystallographic records | Existing ingestion acceptance suite |
| mmCIF/CIF | 3D object | Coordinates, atom-site identity, parsed source annotations, states | Existing ingestion acceptance suite |
| PQR | 3D object | Coordinates and complete source charge field; PQR radii are validated but do not replace the application's VDW model | `AT-FSR-B-001`, `ingestion.test.ts` |
| SDF/MOL | One V2000 molecule as 3D object | Coordinates and declared V2000 bond orders; multi-record SDF fails closed | `AT-FSR-B-002`, `ingestion.test.ts` |
| MOL2/PDBQT/XYZ/SMILES | Not admitted yet | No claim | Planned adapter slices |
| FASTA/FASTQ/GenBank/EMBL | Not admitted yet | No coordinates are fabricated | Planned sequence adapters |
| MRC/CCP4/DX | Not admitted yet | No density/map rendering claim | Planned map adapters |
| Trajectories | Not admitted yet | No trajectory support claim | Research-only pending corpus and performance gate |

The UI lists only admitted coordinate formats. Unsupported formats continue to fail closed at the import boundary.
