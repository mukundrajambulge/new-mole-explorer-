# D3 representability

The controlling architecture remains 16 XS atom types, 80 logical scoring channels, and 59 conditional physical arrays. This comparison uses existing D3 direct/grid contracts, torsion semantics, and immutable same-state requirements. It does not alter or revalidate implementation.

| Candidate | Expected chemistry and torsion fit | Direct/grid and region fit | Disposition |
|---|---|---|---|
| 4W52 / BNZ | Neutral carbon ring and no rotors are ordinary supported chemistry | Region can be defined after receptor state is fixed | Possible graph; no unique construct/altloc state |
| 4W54 / PYJ | Ordinary C/H chemistry; ethyl rotor likely supported | Box only after ligand and protein conformers are fixed | Graph representable; deposited state ambiguous |
| 3ATL / BEN | Nine heavy atoms; ordinary C/N protein/ligand elements; one ligand rotor; amidinium typing/charge must match approved contract | Region frozen after exact state; both scorers must share immutable geometry | Plausible; gate must establish +1 support, water policy, types, rotor count and canonical digests |
| 1M17 / AQ4 | Erlotinib elements likely ordinary; extended ligand needs exact mapping | Feasible after kinase construct and site conformers fixed | Representability plausible; structure ambiguity blocks |
| 3ERT / OHT | Ordinary elements; tertiary amine and flexible torsions need frozen state | Feasible after termini, sidechains and pose state resolve | Conditional; chemical state unresolved |
| 1FJS / Z34 | Ordinary elements but coupled multi-charge assignments must map to approved types | Feasible only after proteolysis, calcium and ligand states are fixed | High state/typing risk; no workaround authorized |
| 1HVR / XK2 | Large cyclic urea, ordinary elements, but dimer-spanning; catalytic state central | Assembly-wide region; both paths must consume both chains identically | Conditional on exact dimer and chemistry |
| 1EVE / E20 | Ordinary elements/torsions; protonatable piperidine | Region can be bounded but reported solvent contacts conflict with dry fixture model | Not suitable without newly approved water model |
| 1STP / BTN | Compact supported elements; stereochemistry/torsions need canonical mapping | Region must preserve biologically relevant tetramer identically | Potentially representable; assembly and construct not frozen |

SearchRegion, prepared-state objects, scoring/typing digests, and cohort assignment remain unset for every candidate. This task created no PreparedReceptorState, PreparedLigandState, SearchRegion, PDBQT, docking pose, or validation result. Full D3 stays HOLD; D4 BLOCKED; DOCKING.RUN unavailable.
