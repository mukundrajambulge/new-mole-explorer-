# Provenance readiness

| Candidate | Source → identity → graph evidence | State derivation obligations | Readiness |
|---|---|---|---|
| 4W52 / BNZ | Official mmCIF hash and unique BNZ instance; CCD benzene graph | Record variant/tag, altloc choices, occupancy, incomplete atoms, profile and mapping | Reproducible source, but unresolved construct/coordinate decisions |
| 4W54 / PYJ | Official mmCIF and unique PYJ instance; CCD ethylbenzene graph | Preserve chosen A/B ligand conformer and protein altlocs; construct/missingness | Source reproducible, conformation choice unapproved |
| 3ATL / BEN | Official mmCIF hash, unique 9/9 BEN instance, CCD graph, mature chain, source and pH records | Separate CCD neutral graph from selected amidinium state; atom charges/resonance, six disulfides, Ca/DMS/water policy, exact tools/settings, state digests | Best readiness for next gate; no prepared state exists and choices remain open |
| 1M17 / AQ4 | Official mmCIF and unique complete ligand | Resolve construct gaps and site altlocs; freeze kinase/ligand state | Missing source-to-construct relation |
| 3ERT / OHT | Official mmCIF and complete OHT graph | Reconcile termini, nearby atoms, amine and water state | Reconstruction would lack approved basis |
| 1FJS / Z34 | Official mmCIF and unique ligand mapping | Preserve autolysis/cleavage identity, component coordination, ligand multi-protomer assignment | Multiple coupled derivations |
| 1HVR / XK2 | Official mmCIF and complete ligand | Resolve sequence conflict, CSO, dimer and Asp dyad | Source/chemical state ambiguous |
| 1EVE / E20 | Official mmCIF and complete ligand | Protonation, solvent network, missing termini/N-terminal atoms | Water-dependent pose hard to represent presently |
| 1STP / BTN | Official mmCIF and complete ligand | Biological tetramer, missing tails, loop state, no deposited pH | Assembly context not frozen |

A future complete derivation chain must retain source hash/retrieval URL, entry and revision, polymer/assembly/ligand identities, explicit graph and atom mapping, coordinate and chemical state, preparation tool versions/binary or container hashes/settings, typed/scoring assignments, PreparedReceptorState and PreparedLigandState digests, SearchRegion/profile digests, independent review, and owner decision. Raw structures or this audit alone are not prepared-state provenance.
