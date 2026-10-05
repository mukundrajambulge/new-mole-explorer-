# PreparedReceptorState Identity Correction

## Change

The active receptor sealing path now requires three explicit identity references: chemical-perception profile, receptor atom-typing profile, and scoring profile. It rejects absent, blank, or malformed references. The values are present in the V2 state payload and are hashed along with the existing molecular and preparation identity inputs.

Implementation locations:

- `packages/contracts/src/docking/d2.ts`: V2 state/dependency contract.
- `apps/api/src/docking/d2Preparation.ts`: dependency validation, provenance, V2 payload and V2 scientific digest.
- `apps/api/src/docking/d2PreparationService.ts`: current service return type.
- `packages/contracts/src/docking/scoringField.ts`: shared profile dependency consistency predicate.
- `apps/api/src/docking/d2Preparation.test.ts`: replay, serialization, change sensitivity, fail-closed, and mismatch checks.
- `tools/seal_3dmx_bnz_states.ts`: corrected 3DMX/BNZ evidence producer under this continuation directory.

## Dependency references sealed for 3DMX/BNZ

| Kind | Profile ID | Profile digest |
|---|---|---|
| Chemistry | `ME_SUPPORTED_CHEMISTRY_V1_1_0` | `sha256:6cb2fbd5dcc5dbfdaded563a574257e79de9efa7a325f4af661666f68fee6237` |
| Receptor typing | `ME_XS_TYPING_V1_1_0` | `sha256:d2a84e624596c65e2245310dc6897ec41d888f2851674b2649a7b5846f29867f` |
| Scoring | `ME_DOCKING_V1_VINA_CLASSIC_1_0` | `sha256:7fa78e00645dbab69b3a989a2967cb5e35071d483987ba84f9a8686be5dedd34` |

## Compatibility and active paths

V2 advances only the prepared-receptor entity schema. Existing V1 objects remain identifiable as historical data and cannot satisfy the active API's V2 type or seal validation. No fallback supplies a global or environment-selected profile. The active 3DMX/BNZ preparation producer explicitly embeds the references.

The old producer under `verification/d3-closure-exec-01/tools/` is preserved as historical evidence and is not the current producer; when invoked against the V2 sealer its absent references fail closed. Repository search found the active service, focused tests, and corrected fixture producer as the supported construction sites. No active incomplete state path is accepted.

No scoring algorithm, coefficient, atom assignment, coordinate, preparation chemistry, grid, or pose was changed. The scoring-field object was not merged into PreparedReceptorState.
