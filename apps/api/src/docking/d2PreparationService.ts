import type { CanonicalMolecularStructure, SourceArtifact, D2SealResult } from "@molecular/contracts";
import { adaptCanonicalStructure, type D2AdapterInput, type D2AdaptedRepresentation } from "./d2Adapters.js";
import {
  sealLigandKinematicModel,
  sealPreparedLigandState,
  sealPreparedReceptorState,
  sealSearchRegion,
  type D2KinematicModelInput,
  type D2PreparedLigandInput,
  type D2PreparedReceptorInput,
  type D2SearchRegionInput,
} from "./d2Preparation.js";
import type { D2LigandKinematicModelV1, D2PreparedLigandStateV1, D2PreparedReceptorStateV1, D2SearchRegionV1 } from "@molecular/contracts";

/**
 * D2's backend seam is deliberately a preparation/sealing service. It does
 * not expose scoring, search, execution, or DOCKING.RUN; those remain later
 * gate capabilities and continue to fail closed in the command registry.
 */
export class D2PreparationService {
  adapt(input: D2AdapterInput): D2SealResult<D2AdaptedRepresentation> {
    return adaptCanonicalStructure(input);
  }

  adaptStructure(structure: CanonicalMolecularStructure, sourceArtifact?: SourceArtifact): D2SealResult<D2AdaptedRepresentation> {
    return this.adapt({ structure, ...(sourceArtifact ? { sourceArtifact } : {}) });
  }

  sealReceptor(input: D2PreparedReceptorInput): D2SealResult<D2PreparedReceptorStateV1> {
    return sealPreparedReceptorState(input);
  }

  sealKinematicModel(input: D2KinematicModelInput): D2SealResult<D2LigandKinematicModelV1> {
    return sealLigandKinematicModel(input);
  }

  sealLigand(input: D2PreparedLigandInput): D2SealResult<D2PreparedLigandStateV1> {
    return sealPreparedLigandState(input);
  }

  sealSearchRegion(input: D2SearchRegionInput): D2SealResult<D2SearchRegionV1> {
    return sealSearchRegion(input);
  }
}
