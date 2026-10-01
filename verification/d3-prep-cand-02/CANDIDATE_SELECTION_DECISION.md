# Candidate selection decision

## Decision

Select exactly one candidate to enter a separate, candidate-specific preparation-authorization gate:

**3ATL / BEN (mature bovine trypsin / benzamidine)**

Classification: **ADMISSIBLE_FOR_NEXT AUTHORIZATION GATE**

This is a selection for further authorization review only. It is not preparation authorization, a prepared fixture, D3 acceptance, or permission to execute any molecular transformation.

## Why this candidate clears the comparative bar

The current official 3ATL mmCIF identifies one complete BEN instance (label asym F, author chain A, residue 5) with all 9 heavy atoms at occupancy 1.00 in one model. The receptor is a mature 223-residue bovine trypsin chain with 223/223 positions observed, no missing standard protein heavy atoms, no receptor alternate conformations, no recorded sequence substitutions, and six deposited disulfide connections. The source is a high-resolution 1.74 Å X-ray structure with a current revision record and crystal-growth pH 8.5. These observations avoid the central 181L failure mode: a partly unresolved construct whose visible endpoint could be mistaken for a biological terminus.

The other candidates have greater unresolved construct, terminal, local-coordinate, assembly, component, or pose-state issues. 4W52 and 4W54 are engineered T4 lysozyme with an unresolved C-terminal tag; 1M17 has an unresolved segment and site alternate conformers; 3ERT and 1EVE have terminal/missingness concerns; 1FJS is an autolyzed multi-chain complex with a multi-charge ligand and extra components; 1HVR has a sequence conflict and catalytic dimer state; 1STP needs a tetramer and binding-associated loop context.

## Required fail-closed issues for the next gate

1. **Identity:** confirm natural mature-chain sequence mapping, true mature termini, and exact six disulfide pairs against authoritative sequence and primary structural evidence.
2. **BEN chemistry:** BEN is benzamidine (C7H8N2), not BNZ benzene (C6H6). The CCD neutral graph has no observed hydrogen atoms. Crystal pH 8.5 and compiled conjugate-acid pKa near 11.6 strongly favor +1 amidinium in bulk solution. This is an inference; the next gate must obtain independent chemical review and define atom-level state or reject the candidate.
3. **Water network:** the source has 317 water atoms; 8 are within 5 Å of BEN. The nearest is 2.747 Å. Literature reports a W1 bridge and water reservoir near Asp189. The next gate must decide whether the bound state can be represented within the approved D3 dry receptor model. If an essential water cannot be represented under an approved profile, stop and return to candidate selection.
4. **Other components:** classify deposited Ca and three DMS molecules. No blanket removal or inclusion is authorized here.
5. **Protein state:** produce an explicit titratable-residue and histidine review, termini/hydrogen policy, and exact toolchain/profile proposal; do not infer microscopic states from bulk pH alone.
6. **D3 contracts:** show the selected chemistry and atom typing fit the approved supported domain, torsion semantics, SearchRegion policy, and same-state direct/grid consumption; create canonical digests only in a later authorized execution lane.
7. **Review and governance:** require independent structural-biology and computational-chemistry review, plus the responsible project owner's explicit decision.

If any item cannot be resolved from authoritative evidence, return HOLD or reject 3ATL and resume bounded candidate search. No preparation, hydrogen addition, ligand state generation, PDBQT generation, or docking is authorized by this selection.
