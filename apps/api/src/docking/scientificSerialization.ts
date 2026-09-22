import { createHash } from "node:crypto";
import { DOCKING_CANONICALIZATION_PROFILE, encodeCanonicalCbor, sha256Digest, type Sha256Digest } from "@molecular/contracts";

export const scientificDigest = <Tag extends string>(digestClass: string, semanticSchemaId: string, payload: unknown): Sha256Digest<Tag> => {
  const envelope = ["ME-PHDV2-DIGEST", 1, digestClass, semanticSchemaId, DOCKING_CANONICALIZATION_PROFILE, payload] as const;
  const bytes = encodeCanonicalCbor(envelope);
  const hex = createHash("sha256").update(bytes).digest("hex");
  return sha256Digest<Tag>(`sha256:${hex}`);
};

export const artifactByteDigest = <Tag extends string = "ArtifactByteDigest">(bytes: Uint8Array): Sha256Digest<Tag> =>
  sha256Digest<Tag>(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
