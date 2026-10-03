# Alternate conformations, waters, and source components

All dispositions below are recommendations for one future `ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0` receptor. The source mmCIF is preserved byte-for-byte and is not edited. Every exclusion creates explicit component/provenance records; no raw source row is deleted.

## MET106 and GLU108

| Residue | Deposited states | Source occupancy | Min distance to BNZ (A/B) | Proposed derived state |
|---|---|---:|---:|---|
| MET106, entity 1 / label A / auth A 106 | A/B; affected CA, CB, CE, CG, SD | A 0.70, B 0.30 | 7.9205 / 8.0028 Å | choose coherent A |
| GLU108, entity 1 / label A / auth A 108 | A/B; affected CA, CB, CD, CG, OE1, OE2 | A 0.70, B 0.30 | 7.6341 / 7.6590 Å | choose coherent A |

Use `COHERENT_MAX_OCCUPANCY_V1`, one explicit selected label A per group, retain blank/common atoms, and never average or merge A/B coordinates. Preserve the A/B source occurrences, occupancies, mappings, and removed-state list in provenance. This is a deterministic coordinate-state choice, not a pH/protonation choice.

## Water

There are no source waters within 5 Å of BNZ and one within 8 Å: label asym H / auth chain A / HOH 1147, 7.8253 Å from BNZ atom C2. Its nearest receptor atom is Val87 CG2 at 3.2703 Å; the source analysis found no direct ligand–water contact and no geometric ligand–water–protein bridge.

For `CORE_DRY_V1`, exclude water occurrences from the scoring representation by the named dry-profile operation, while retaining all water occurrences in the immutable ExperimentalStructureState and recording each role/disposition. The nearest water is not supported as an essential ligand water. If later site-influence review finds it is essential, ordinary dry-core use stops; no fixed/mobile-water profile is silently substituted.

## Non-water non-polymers

| Source occurrence | Identity | Nearest BNZ distance | Proposed role/disposition |
|---|---|---:|---|
| label asym E / auth A 904 | HED, 2-hydroxyethyl disulfide | 10.8478 Å | crystallization/additive context; source-only, omit from dry scoring representation |
| label asym F / auth A 905 | HED, 2-hydroxyethyl disulfide | 11.6196 Å | crystallization/additive context; source-only, omit |
| label asym B / auth A 901 | PO4, phosphate | 15.3395 Å | crystallization buffer; source-only, omit |
| label asym C / auth A 902 | PO4, phosphate | 20.1564 Å | crystallization buffer; source-only, omit |
| label asym D / auth A 903 | CL, chloride | 32.5330 Å | remote crystallization component; source-only, omit |

No metal/cofactor is in the ligand 8 Å shell. BNZ is excluded from the receptor graph as the reference-ligand occurrence but is separately represented as the selected ligand; its source occurrence remains provenance evidence. These decisions name every non-water component relevant to the source inventory and do not authorize blanket HET deletion.

The deposited entry lists 248 source water occurrences. The policy recommendation remains itemized and provenance-bearing: retain all 248 in ExperimentalStructureState, record the one 8 Å-shell occurrence by identity and distance, then omit water occurrences from the separate dry scoring representation only through the named CORE_DRY_V1 policy. This preserves source evidence and is not a generic source-file/HETATM deletion.
