# Structural-biology review material — 9I7O

## Scope and status

This is Codex's evidence-based review package for the D3-PREP-DEC-03 gate. It is not an independent human structural-biologist approval. Reviewer responses remain pending; see REVIEW_STATUS.md.

## Source identity and biological construct

The frozen source is 9I7O revision 1.1, one 2.00 Å X-ray model. The receptor is entity 1 / label asym A / author chain A. The author-designated biological assembly 1 is a monomer. The primary article identifies lyophilized bovine-milk beta-lactoglobulin (Sigma L3908); the natural sequence maps to Bos taurus P02754. The evidence does not establish the purchased milk lot's A/B genotype proportions. No recombinant tag is identified.

UniProt precursor residues 1–16 are the signal peptide; the mature protein begins at Leu17. The natural mature sequence spans precursor 17–178. Do not call the coordinate chain's first residue a proven biological terminus merely because its predecessor is unresolved.

## Natural variants and pocket state

The deposit contains a natural A/B mixture, not a synthetic consensus. At precursor 80 / mature 64 the modeled states are Asp A 0.746 and Gly B 0.254. At precursor 134 / mature 118 they are Val A 0.746 and Ala B 0.254. The latter is directly adjacent to the bound retinol (minimum 3.516 Å), so variant choice changes the ligand environment. Phe105 is a separate side-chain rotamer alternative, A 0.720 and B 0.280; the minor B state clashes with RTL at 1.4944 Å while A has a 3.3453 Å minimum. RTL occupancy is 0.720.

For a single initial development coordinate state, the source cohort proposed the coherent maximum-occupancy A realization. That is an explicit model choice, not evidence of a homogeneous sample and not yet owner-approved for preparation.

## Missing coordinates and termini

- Mature Leu17 is present in the natural protein sequence but unobserved in the 9I7O model. It is not the cleaved signal peptide; it is the first mature residue. The first modeled residue is precursor Ile18. Adding Leu17 atoms or coordinates is prohibited in this gate.
- Internal precursor 127–130 / mature 111–114 is sequence AEPE and is unobserved. 9I7O provides no direct coordinates or ligand distance for this loop. The predecessor used 1GX8 as a homolog; the closest corresponding residue in those homolog coordinates is about 11.17 Å from RTL. That is only a remote-site inference. PHD-V2-03 REC-D06 does not set a generic distance cutoff and requires site relevance to be evaluated.
- D2 sealing requires coordinates for every atom in the graph and has no structured field for missing-polymer/terminal continuation. No approved method shows how to represent the actual chain connectivity through unmodeled Leu17 while leaving all missing heavy atoms absent and avoiding an incorrect Ile18 terminus. Do not hide the unresolved representation behind a chain cleanup or cap.

## Missing binding-site sidechain atoms

The deposited mmCIF audit marks 21 heavy-atom rows missing from seven otherwise observed residues. Four incomplete sidechains lie in the ligand environment: precursor/label ASP101 (author 85) lacks CB/CG/OD1/OD2, LEU103 (author 87) lacks CG/CD1/CD2, ASN104 (author 88) lacks CG/OD1/ND2, and GLU105 (author 89) lacks CB/CG/CD/OE1/OE2. The nearest observed atom from these residues to RTL is 6.3939, 3.6203, 3.9869, and 6.5587 Å, respectively. Those distances are to observed atoms only; positions of the absent atoms cannot be measured. LEU103 and ASN104 directly flank the pocket. ASP101/LEU103/ASN104/GLU105 are all within the current Vina scoring support horizon by observed-residue distance, so their omitted sidechains cannot be certified irrelevant.

The other incomplete sidechains are SER126 (author 110; OG absent; nearest observed residue atom 9.7942 Å), GLN131 (author 115; CG/CD/OE1/NE2 absent; 12.2793 Å), and ALA158 (author 142; CB absent; 16.3241 Å). These are also source gaps and must remain recorded. PHD-V2-03 REC-D06 makes missing binding-site heavy atoms a preparation blocker unless an explicitly authorized, validated repair profile exists. No such profile exists, and no repair was attempted.
## Disulfides, waters, and other components

The source explicitly records Cys66–Cys160 and Cys106–Cys119 disulfides (2.030 and 2.033 Å). Preserve source connection evidence; do not infer or break bonds from geometry alone.

There are 35 modeled waters. One is within 5 Å and two within 8 Å of any ligand heavy atom. The closest water is 4.0359 Å from ligand C18 and near receptor Leu39 O/Gln120 NE2, but not in direct ligand contact under the audit's 3.5 Å criterion. The closest to retinol O1 is 6.5656 Å. No ligand–protein water bridge was identified. The primary 9I7O paper describes retinol accommodated in the hydrophobic beta-lactoglobulin calyx and does not report a required water bridge. CORE_DRY_V1 has a scientifically explicit water-exclusion profile, with a limitation to disclose. Preserve the 35 waters in source evidence; no water was removed here.

The coordinate inventory contains RTL and HOH only among nonpolymers; no metal, ion, cofactor, glycan, or additional ligand occurs. Treat RTL as reference-ligand evidence for any later receptor derivation, not as an unexplained HETATM deletion. Crystallization reagents remain experimental context and are not modeled components.

## Coordinate integrity and validation

Source heavy atoms and coordinates remain unchanged. The official validation PDF reports R-free 0.1965, all-atom clashscore 5, no Ramachandran outliers, one RTL bond-length outlier and three RTL bond-angle outliers, but no RTL torsion, ring, or chirality outliers. The minor Phe105 alternate explains the local clash sensitivity. Do not optimize or repair the experimental heavy-atom model during source authorization.

## Human structural-biologist questions before any future authorization

1. Is the selected author-designated monomer / chain A and one coherent major-A crystal state suitable as a development-only receptor, given that Val134/mature118 lies 3.516 Å from RTL and the original milk lot is not genotyped?
2. Can a chemically valid receptor state preserve the physical peptide continuation through unobserved mature Leu17 while adding no heavy atoms and never assigning a false N-terminal state to Ile18? If not, is this fixture inadmissible under the current no-reconstruction constraint?
3. Is the 1GX8 homolog evidence sufficient to classify the unobserved AEPE loop as remote for this specific site, or must its absence remain blocking? Please state the structural evidence and any chosen site-influence criterion.
4. Does the nearby water at 4.0359 Å from RTL C18 have a pocket-organizing role that makes its exclusion material, despite the lack of a direct ligand contact/bridge? Confirm the evidence basis for dry-profile eligibility.
5. Confirm that source heavy atoms, all raw A/B alternatives, source waters/components, and validation anomalies remain immutable provenance in any future derivation.

**Reviewer disposition:** NOT PROVIDED. No human approval is claimed.