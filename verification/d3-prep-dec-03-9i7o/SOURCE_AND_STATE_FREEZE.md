# 9I7O source and candidate-state freeze

## Immutable source record

- **PDB accession/version:** 9I7O, current RCSB revision v1.1 dated 2026-09-09.
- **Experimental method/resolution/model:** X-ray diffraction, 2.00 Å, one deposited model.
- **Assembly:** deposited asymmetric unit has one protein instance; RCSB author-assigned biological assembly 1 is monomeric. Candidate receptor selection under review: assembly 1 / chain A, entity 1, label asym A, source model 1.
- **Protein/source:** Bos taurus beta-lactoglobulin mapped to UniProt P02754. The primary article describes lyophilized bovine-milk beta-lactoglobulin powder (Sigma L3908), not a recombinant tagged construct. The 178-residue natural precursor has signal peptide residues 1–16; mature protein is residues 17–178. No engineered tag is identified. Two natural A/B polymorphic sequence sites are modeled; the source lot's genotype proportions are not reported.
- **Coordinate coverage:** modeled label sequence 18–178 with internal precursor residues 127–130 absent. Mature Leu17 is part of the mature protein but unmodeled. The model contains 1,247 observed receptor heavy atoms; the selected source audit counts 159 observed residue records including alternate conformers.
- **Incomplete observed-residue heavy atoms:** the mmCIF audit records 21 unobserved atom rows across seven partial sidechains. Residue mapping and nearest distance from each residue's *observed* atoms to RTL are in the table below; distances do not locate the absent atoms.
- **Disulfides in source _struct_conn:** author Cys66–Cys160, 2.030 Å; author Cys106–Cys119, 2.033 Å. Preserve these source links and oxidation state evidence explicitly in any later state.
- **Ligand occurrence:** CCD RTL, entity 2, label asym B, author chain A, residue 500; noncovalent, 21/21 heavy atoms observed, occupancy 0.720, no ligand altloc.
- **Source revision evidence:** raw mmCIF _pdbx_audit_revision_history includes 1.0 (2026-02-18) and 1.1 (2026-09-09). RCSB's version history describes the 1.1 change as database-reference metadata. The frozen source bytes below are from the committed D3-FIXTURE-COHORT-02 evidence bundle and were not replaced or edited here.

## Source artifact byte identity

All paths are repository-relative. SHA-256 and byte lengths were recomputed in this task. The complete predecessor manifest verification is recorded in D3_PREP_DEC_03_DECISION.md.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| verification/d3-fixture-cohort-02/source_artifacts/cif/9I7O.cif | 341749 | 26272ac1425736c1858f9cef40cbd7442977d6a0863e70b5b7ee78206d90c9c0 |
| verification/d3-fixture-cohort-02/source_artifacts/ccd/RTL.cif | 10526 | 16a259d19a1136ea7abf8a821dff8570c3ef241712f1e4a57a13aaa2d4e7f369 |
| verification/d3-fixture-cohort-02/source_artifacts/metadata/9I7O_entry.json | 11931 | f3c7f14efd53897e724f7acf30befbe77ec7f8b960a69ad8ce11a5f6d4c1214d |
| verification/d3-fixture-cohort-02/source_artifacts/metadata/9I7O_polymer_entity.json | 14543 | e297acf8586c0d884a237fb98b3d20e01f10ded0cf3b0e8a97a31af4cd70497a |
| verification/d3-fixture-cohort-02/source_artifacts/metadata/9I7O_inventory.json | 4750 | 0c99426d7e5c9fd7920094720a6093c963929e6811480f619bf1afb0fe5343fa |
| verification/d3-fixture-cohort-02/source_artifacts/validation/9I7O_full_validation.pdf | 701463 | 76538470340db2a2ec72b1e950d39d3fba6d606d0c2f27503a3eca97fa821620 |
| verification/d3-fixture-cohort-02/source_artifacts/SHA256SUMS.txt | — | c965caca67fcc8e2d851318806e6a046684389490859b331d7693cee04e5c550 |

The official full validation report states 2.00 Å resolution, R-free 0.1965 and R-work 0.1761; all-atom clashscore 5; no Ramachandran outliers; and, for RTL, one bond-length outlier and three bond-angle outliers, with no torsion, ring, or chirality outliers. RTL outliers are retained as source evidence; no geometry correction was applied.

## Receptor coordinate state proposed for future review (not sealed)

- Use model 1, chain A/entity 1 and the deposited/author-designated monomer assembly.
- Preserve raw alternates, then select one coherent major-A coordinate realization only if the owner and domain reviewers approve it. Do not create a consensus sequence or average coordinates.
- Natural sequence alternatives: precursor 80/mature 64 is Asp A 0.746 vs Gly B 0.254; precursor 134/mature 118 is Val A 0.746 vs Ala B 0.254. Phe105 is a rotamer alternative, A 0.720 vs B 0.280. RTL occupancy is 0.720.
- The major Val134 state is pocket-adjacent: nearest ligand distance 3.516 Å. Asp80 is about 15.9635 Å from RTL. The minor Phe105 B rotamer clashes with RTL at 1.4944 Å; the coherent A rotamer has a 3.3453 Å minimum heavy-atom separation. Thus variant 134 materially changes the scoring environment; the major-A model is one explicitly selected crystal state, not proof of a homogeneous A milk sample.
- Keep Leu17 and AEPE residues 127–130 absent from coordinates in this gate. Do not infer that Ile18 is a biological N terminus. Do not rebuild, cap, flip, move, rename ambiguously, or delete source heavy atoms.

## Missing side-chain atoms near the binding site

The nearest distances below are minima from the observed atoms in each listed residue to the selected major-A RTL coordinates. Missing atom coordinates themselves are unknown. The mmCIF author numbering maps to the natural precursor/label sequence by +16 in these examples.

| Precursor/label residue | Author residue | Missing heavy atoms | Nearest observed residue atom to RTL |
|---|---:|---|---:|
| ASP101 | 85 | CB, CG, OD1, OD2 | 6.3939 Å |
| LEU103 | 87 | CG, CD1, CD2 | 3.6203 Å |
| ASN104 | 88 | CG, OD1, ND2 | 3.9869 Å |
| GLU105 | 89 | CB, CG, CD, OE1, OE2 | 6.5587 Å |
| SER126 | 110 | OG | 9.7942 Å |
| GLN131 | 115 | CG, CD, OE1, NE2 | 12.2793 Å |
| ALA158 | 142 | CB | 16.3241 Å |

The four first residues have observed atoms inside the PHD-V2-06 scoring support horizon (8.649519 Å), and LEU103 / ASN104 are immediately pocket-adjacent. That does not give coordinates for their absent side-chain atoms. Their site influence therefore cannot be ruled out. PHD-V2-03 REC-D06 requires a separately validated repair profile and explicit authorization for missing binding-site heavy atoms; neither exists. No reconstruction was done.
## AEPE distance evidence and limits

9I7O itself supplies no coordinates for precursor 127–130 / mature 111–114, so their direct distance to RTL in 9I7O is **undefined**, not zero or an observed remote distance. In the predecessor's 1GX8 homolog coordinate audit, the aligned corresponding mature residues have minima to RTL of approximately Ala111 14.6539 Å, Glu112 12.0686 Å, Pro113 11.1668 Å, and Glu114 12.0201 Å. These support a remote-site hypothesis by homology only; they do not establish 9I7O loop geometry or satisfy a project-approved numeric site-influence cutoff. Structural-biology review remains required.

## Water and component inventory

- 35 deposited HOH residues (one oxygen each); one water is within 5 Å of a ligand heavy atom; two are within 8 Å.
- Nearest water, author residue 605, is 4.0359 Å from ligand C18. It is 2.5548 Å from Leu39 O and 2.8942 Å from Gln120 NE2; the audit finds no direct ligand-water contact under its 3.5 Å criterion and no ligand–protein bridge.
- The next nearest water, author residue 602, is 6.5656 Å from RTL O1 and 2.3576 Å from Leu87 O; no bridge to RTL was identified.
- No metal, cofactor, ion, glycan, buffer, or additional non-water nonpolymer is present in the coordinate model. Crystallization reagents in the methods are source context, not deposited receptor components.
- Proposed future role disposition: preserve every water and the reference RTL in immutable source evidence; if and only if the later authorized CORE_DRY_V1 profile is executed, explicitly classify all 35 waters for dry-profile exclusion and RTL as REFERENCE_LIGAND. No component was stripped in this gate.

## Ligand graph and candidate kinematics

- RCSB CCD RTL / RETINOL, formula C20H30O, formal charge 0, InChIKey FPIPGXGPPPQFEQ-OVSJKPMPSA-N; 21 heavy atoms, all-trans 2E,4E,6E,8E, zero tetrahedral chiral atoms.
- CCD canonical SMILES (CACTVS): CC(=C\CO)/C=C/C=C(C)/C=C/C1=C(C)CCCC1(C)C. The byte-exact graph source is the frozen RTL.cif above.
- Observed source ligand coordinates are complete for all 21 heavy atoms. Audited heavy-atom bounds in the source frame are x [3.36420, 14.40788], y [-3.63735, 6.26794], z [-1.09950, 4.51020] Å. These are ligand-coordinate bounds only, not a sealed SearchRegion.
- Under the semantic PHD-V2-04 rotor criteria, the candidate search axis is the acyclic C14–C15 single bond; its moving fragment contains the terminal CH2OH heavy atoms. Candidate search_torsion_count = 1 is Codex graph analysis only. It has not been recorded into or sealed as a LigandKinematicModel; root/tree, exact atom mapping, axis coordinates and profile digest are not frozen.
- Scorer torsion accounting is distinct. No N_tors_vina or PDBQT TORSDOF was generated or inferred from the search count. No PDBQT file exists for this candidate.

## Future object status

| Object | Status in this gate |
|---|---|
| ExperimentalStructureState | Source evidence frozen by accession/revision/hash and predecessor artifacts. |
| ReceptorCoordinateState | Exact source/model/chain and proposed major-A realization described; owner/reviewer acceptance pending. |
| ReceptorChemicalState | **Not frozen:** pH-dependent microstates, termini, H placement/orientation and side-chain orientation need explicit review/profile. |
| PreparedReceptorState | **Not created or sealed.** No approved exact preparation profile/toolchain; Leu17 continuation representation is unresolved. |
| Ligand MolecularIdentity / CCD graph | Source graph fixed by RTL.cif hash and CCD identity. |
| Ligand ChemicalState | CCD neutral all-trans identity is supported; state/atom mapping and explicit-H realization are not packaged or sealed. |
| LigandKinematicModel | **Not created or sealed.** One candidate search torsion was identified; scorer quantity remains distinct/unmaterialized. |
| PreparedLigandState | **Not created or sealed.** No approved hydrogen/toolchain profile. |
| SearchRegion | **Not created or sealed.** Only source ligand envelope is recorded. No docking box is inferred. |
| Development role | DEVELOPMENT only; any later use burns confirmatory holdout status. |

## Rerun source capture and byte identity

On 2026-10-03, the primary source files were fetched again from the current official RCSB endpoints and retained under source_artifacts/current_rcsb/. SHA-256 values match the corresponding raw files in the cohort predecessor bundle exactly; the bytes were not transformed.

| Retained file | Official endpoint | Bytes | SHA-256 |
|---|---|---:|---|
| source_artifacts/current_rcsb/9I7O.cif | https://files.rcsb.org/download/9I7O.cif | 341749 | 26272ac1425736c1858f9cef40cbd7442977d6a0863e70b5b7ee78206d90c9c0 |
| source_artifacts/current_rcsb/RTL.cif | https://files.rcsb.org/ligands/download/RTL.cif | 10526 | 16a259d19a1136ea7abf8a821dff8570c3ef241712f1e4a57a13aaa2d4e7f369 |
| source_artifacts/current_rcsb/9I7O_full_validation.pdf | https://files.rcsb.org/validation/view/9i7o_full_validation.pdf | 701463 | 76538470340db2a2ec72b1e950d39d3fba6d606d0c2f27503a3eca97fa821620 |

The current official entry identifies revision 1.1, whose 2026-09-09 revision-history change is database-reference metadata. The official full validation report was retained unchanged. Its source findings, including the RTL bond/angle validation outliers, are evidence only; no repair or optimization was applied.

A compact predecessor snapshot in source_artifacts/predecessor_snapshot/ retains the selected audit/context JSON, metadata snapshots, source matrices, cohort report, and the original 149-entry source manifest. The manifest verification result is 149/149 present and matching. Rerun-lane file hashes are listed in SOURCE_SHA256SUMS.txt.

## Cohort matrix correction

The source-tractability row lists impossible label-sequence positions 179 and 180 as missing. The current mmCIF and selected-candidate audit establish a 178-residue entity, observed through residue 178, with genuine missing positions 1-17 and 127-130. There is no modeled-sequence gap after residue 178. The 157 distinct observed sequence positions equal 178 minus 21 unobserved positions; 159 audit residue records include alternate conformers. The correction is documented without modifying the original matrix in SOURCE_AUDIT_RECONCILIATION.md.
