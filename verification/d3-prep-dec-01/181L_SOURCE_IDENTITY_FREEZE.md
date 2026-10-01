# 181L source identity freeze

## Frozen digital artifact

The preserved artifact is the current deposited 181L mmCIF payload retrieved as a Drive attachment from two independently maintained evidence records:

1. D3-IR-01 source artifact, Drive file ID 1G1wLfc7YVE9UOxat2mLMyK-ZV4jAvNf_, titled 181L_current.cif.
2. D3-VAL-01 source artifact, Drive file ID 1dey4zUO3Pvc2Pviz1L8ytEphe69Ek4RO, titled 181L.cif.

The retrieved base64 payloads were byte-identical. The frozen local copy is source_artifacts/181L_current.cif. Its size is 195,587 bytes and SHA-256 is 7ef097473b7f0c906f10e4016e4b6e5973abf4e47bf910699912913404dbb671. The calculated values were checked after writing. The manifest includes this file.

## Identity and revision

The file identifies entry 181L, uses the current mmCIF representation, and reports the latest revision date 2024-02-07. The deposited structure was released 1995-07-10; the source reports X-ray diffraction and 1.80 Å high-resolution limit. The source title concerns ligand binding in the buried non-polar cavity of T4 lysozyme.

Official cross-checks:
- RCSB entry: https://www.rcsb.org/structure/181L
- Current mmCIF endpoint: https://files.rcsb.org/download/181L.cif
- wwPDB entry history: https://www.wwpdb.org/pdb?id=pdb_0000181l
- D3-IR-01 source record: https://drive.google.com/file/d/1sZxrZc4e1W09NxTR3uP09rJqQ71B6FeM/view
- D3-IR-01 source manifest: https://drive.google.com/file/d/1X8_n_Org_pEzez9hc795DUJIT4IxICU8/view

## Frozen identifiers read from the source

- Entry: 181L.
- Protein: entity 1, polymer length 164, author chain A / label asym A.
- Model: 1.
- BNZ: entity 4, label asym E, author chain A, author residue 400; source has six heavy-atom coordinates named C1 through C6.
- Assembly record 1 is described as author-defined and monomeric; the assembly generator lists asym IDs A,B,C,D,E,F. Do not infer component inclusion from “monomeric” alone.
- Source sequence contains ASN163 and LEU164, but atom-site coordinates stop at Lys162.
- The source mmCIF describes substitutions Thr54, Ala97, and Ala99 relative to the referenced UniProt sequence through struct_ref_seq_dif records.

## Scope limitation

This freezes the digital deposited structure, not the vial, plasmid, clone, construct preparation, or exact experimental sample used to collect diffraction data. The structure summary's “Mutation(s): No” statement conflicts with the detailed sequence-difference annotations. Literature context makes an L99A cavity variant with C54T/C97A background plausible, but does not identify the exact sample lot used for 181L. Do not silently resolve this conflict. The file is immutable evidence; it is not a prepared receptor, a D2 state, or an authorization to prepare.