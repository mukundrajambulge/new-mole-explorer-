# Provenance chain and D3 state-consumption disposition

## Verified source lineage

| Stage | Identity / evidence | Digest status | State classification |
|---|---|---|---|
| Deposited structure | RCSB PDB 3ATL; official current mmCIF | SHA-256 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46; local and fresh official download byte-identical | ExperimentalStructureState evidence only |
| Receptor source | Entity 1, label/auth chain A, model 1; sequence exactly UniProt P00760:24–246 | Covered by exact 3ATL source-byte digest and source mapping | Not ReceptorIdentity/PreparedReceptorState by itself |
| BEN source | CCD BEN, label asym F, author chain A/residue 5, model 1; 9/9 heavy atoms | Structure-source digest plus current CCD BEN comparison; current CCD retrieval SHA-256 a7ce813cbbac599168d4772f635ae23d7c6edb4d83a9891ebabcbe9e8bb66849 | Source ligand graph/coordinates only |
| BEN/BNZ distinction | Current CCD BEN and BNZ retrieved independently | BEN SHA-256 above; BNZ SHA-256 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61 | Identity evidence only |
| Published site-water evidence | Ansari et al. 2022; neutron study 2018 | DOI/URL references in WATER_NETWORK_AUDIT.md | Literature evidence; not a prepared receptor state |
| Receptor chemical/coordinate state | No explicit protonation profile, hydrogen coordinates, component policy, preparation profile or canonical digest | Absent | Not created |
| Ligand chemical/coordinate state | No approved BEN bound ChemicalState, hydrogen map, typing, kinematic model, preparation profile or canonical digest | Absent | Not created |
| Shared experiment state | No SearchRegion digest, scoring/typing/grid profile bundle or state-digest pair | Absent | Not created |

The source of truth for hashes and local dependencies is verification/d3-prep-dec-02/SHA256SUMS.txt. The official current CCD CIF files were checked in temporary storage and are represented by their hashes and official endpoints in this lane; they were not treated as prepared states.

## Required future lineage, if a new candidate passes

The source artifact must lead through explicit ReceptorIdentity and ExperimentalStructureState to approved ReceptorChemicalState, CoordinateState, role-classified components and a versioned preparation profile before a PreparedReceptorState can be sealed. BEN-like ligands require a unique graph/atom-UID mapping, an explicit ChemicalState and CoordinateState, explicit hydrogen and typing state, and a distinct LigandKinematicModel before PreparedLigandState sealing.

Each derived object must record its parent digest, exact tool/profile/environment, source atom correspondence, transformations, warnings, validation outcomes and canonical digest under the controlling PHD-V2-10 rules. Heavy-atom identity and coordinates must remain invariant unless an independent, exact scientific authorization permits a documented transform.

## Direct/grid identity requirement

For any future direct-versus-grid full-pose check, both pathways must consume the same immutable receptor and ligand state digests, the same coordinate geometry, and one sealed SearchRegion. The state and profile digests must be recorded in a shared experiment manifest. A raw experimental structure, PDB/PDBQT file, visible molecule, or hand-interpreted coordinate file does not satisfy this requirement.

No direct or grid molecular scoring/validation was performed here. There is no state pair or region digest to compare. This field is **NOT SATISFIED**, by design, because 3ATL/BEN was rejected before preparation.

## References

- [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit)
- [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit)
- [PHD-V2-05](https://docs.google.com/document/d/1LEjVH3QmEWlzRzt_xAX-rZPVBTBP1tsIhOUyX-fPeck/edit)
- [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit)
- [PHD-V2-15](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNV8rTVuTZmiMicjHIVEfmpM/edit)
