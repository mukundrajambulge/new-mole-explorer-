# Water confirmation audit

Independent coordinate analysis of current official 4W52 mmCIF model 1 finds 146 crystallographic water sites, zero within 5 Å of BNZ and one within 8 Å. The nearest is HOH author chain A / residue 400 (label asym D), occupancy 1.00. Its oxygen is 7.841 Å from BNZ C5 and 2.624 Å from Lys83 O, its closest protein atom. It is not within 3.5 Å of BNZ and therefore does not form a direct ligand-mediated bridge by the stated geometric criterion. No specific functional role for this water was identified in the accessible primary article.

There are 18 water sites with alternate-location records in the coordinate file. None of their alternative water states lies within 8 Å of BNZ. The 7.841 Å nearest water is a single full-occupancy state.

For a future CORE_DRY_V1 structure, omitting all crystallographic waters can be a defensible explicit dry-state policy for this BNZ shell: there is no water ≤5 Å, the sole water ≤8 Å is not a ligand bridge, and the paper does not identify it as essential. This is a project-level disposition, not a claim that water can always be deleted. A future gate must name the water policy and preserve the source water list/provenance. This water result does not resolve construct identity or terminal chemistry.
