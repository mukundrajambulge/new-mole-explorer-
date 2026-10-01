# Provenance chain matrix

The admission chain must be reconstructable from source bytes through each sealed state and into one shared experiment. The matrix records what is present and what is missing.

| Chain stage | Required evidence | Finding |
|---|---|---|
| Source artifact | Exact archive/source URL or accession, immutable source bytes, source SHA-256, retrieval record | Raw audit evidence exists for some candidates. No source artifact is linked to a sealed state object. The five prior-screen candidates lack lane-level raw provenance re-establishment. |
| Receptor identity | Stable residue/atom mapping, assembly/model/chains, construct and mutation identity, identity digest | Candidate audit notes exist for audited candidates. No D2-sealed receptor identity digest is present. 181L has unresolved construct annotation discrepancy and missing ASN163/LEU164. |
| Receptor chemical state | pH authority, protonation, histidine, termini, disulfide, water/ion/metal/cofactor roles, chemical-state digest | No approved candidate state or digest. Experimental mother-liquor pH values are contextual evidence, not an authorized protonation state. |
| Receptor coordinate state | Frozen selected coordinates, altloc and missingness decisions, hydrogen policy, coordinate-state digest | No frozen state. Audits identify missing residues, alternate conformers, and component questions. |
| Receptor preparation | Approved profile/version/digest, exact tools/settings, typing, validation, provenance, PreparedReceptorState digest | No accepted prep profile or prepared receptor object. D3-RA tools are research evidence only. |
| Ligand source and mapping | Exact component identity, source-to-atom mapping, connectivity/stereo/charge evidence, source hash | Raw component identity is reported for audited candidates. No sealed source-to-chemical-state chain. |
| Ligand chemical/coordinate state | Explicit protomer/tautomer/stereo, frozen finite 3D coordinates, coordinate and chemical-state digests | No approved candidate state or digest; ligand-specific ambiguities remain. |
| Ligand preparation and typing | Approved exact profile, atom mapping, supported XS typing, kinematic model, provenance and PreparedLigandState digest | No accepted prepared ligand object or profile digest. |
| D3 torsion interpretation | Pinned Vina profile, raw branch/TORSDOF evidence, exact atom/bond mapping, scorer-specific N_tors digest | The repository has a D3 torsion contract/profile, but no candidate-bound torsion record. It is not a ligand prepared state. |
| SearchRegion | Exact frozen receiver frame and closed AABB, provenance, canonical digest | No candidate-bound SearchRegion or digest. |
| Scoring/grid/numeric profiles | Current scoring, typing, grid, and numeric backend profiles and immutable digests | Architecture/contracts exist. No shared fixture-bound profile tuple. |
| Direct and grid consumers | Read-only evidence both consume the same exact state and tuple | Not demonstrated because no pair exists. |
| Result provenance | Fixture, pathway, output, validation, and cohort digests with outcome protection | No admitted development or confirmatory result set. |

## Source anchors
- Local D2 schemas: packages/contracts/src/docking/d2.ts.
- D3 scorer torsion schema/profile: packages/contracts/src/docking/d3VinaTorsion.ts.
- Synthetic input metadata: apps/api/src/docking/fixtures/d3-ir-02/fixture-provenance.json.
- D2 catalog and implementation evidence: verification/docking/d2/03_FIXTURES/D2_FIXTURE_CATALOG.md and verification/docking/d2/02_IMPLEMENTATION_INDEX/D2_IMPLEMENTATION_INDEX.md.
- Candidate audit and authorization status: [D3-VAL-01](https://drive.google.com/drive/folders/1KVXKzwacjAjQSJri2VzP7byXpNt8F08H) and [D3-RA-01](https://drive.google.com/drive/folders/18a3MguBMgcnYVfMTBdgHQ9XxetQHfinQ).
- Cohort admission: [D3-SCI-03 manifest](https://drive.google.com/file/d/1khcukrEnWgHyBcZ6SOm7hwBb2Hj-W0M8/view).
- Current hash and serialization authority: [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit).
