import { describe, expect, it } from "vitest";
import {
  BACKEND_VALIDATION_EQUIVALENCE_STATUSES,
  CAMPAIGN_COMPLETION_STATUSES,
  CAPABILITY_ASSESSMENT_STATUSES,
  COMMAND_JOB_STATES,
  DOCKING_CANONICALIZATION_PROFILE,
  DOCKING_REPOSITORY_ARCHITECTURE_V1,
  DOCKING_WORKFLOW,
  EXECUTION_EVENT_TYPES,
  REQUEST_PREFLIGHT_STATUSES,
  ORDINARY_V1_NON_OVERRIDABLE_OUTCOMES,
  SCIENTIFIC_PROFILE_IDS,
  SCIENTIFIC_RESULT_STATUSES,
  canonicalCborHex,
  decodeCanonicalCbor,
  encodeCanonicalCbor,
  f64Bits,
  f64Value,
  scientificId,
  sha256Digest,
  type CompoundDockingAggregate,
  type DockingDraftRequestV1,
  type DockingRequestV1,
  type MolecularIdentity,
  type PdbqtExecutionRepresentationRef,
  type SearchRegionRef,
} from "@molecular/contracts";
import { CommandDispatcher } from "../command/dispatcher.js";
import { compileSafeCommand, isSafeCommandText } from "../command/compiler.js";
import { RESERVED_FUTURE_COMMAND_FAMILIES, RESERVED_FUTURE_COMMAND_METADATA, resolveCommand } from "../command/registry.js";
import { scientificDigest } from "./scientificSerialization.js";
import { D1_FINAL_INTEGRATION_FIXTURES, D1_REQUIREMENT_EVIDENCE, D1_REQUIREMENT_IDS } from "./d1RequirementMatrix.js";

const digest = <Tag extends string>(suffix: string) => sha256Digest<Tag>(`sha256:${suffix.padStart(64, "0").slice(-64)}`);

describe("PHD-V2 D1 normalized acceptance", () => {
  it("maps exactly the 40 authorized D1 requirements to acceptance evidence", () => {
    expect(D1_REQUIREMENT_IDS).toHaveLength(40);
    expect(new Set(D1_REQUIREMENT_IDS).size).toBe(40);
    expect(D1_REQUIREMENT_EVIDENCE).toHaveLength(40);
    expect(D1_REQUIREMENT_EVIDENCE.every((entry) => entry.acceptanceTestId === entry.requirementId.replace("-REQ-", "-AT-"))).toBe(true);
    expect(D1_REQUIREMENT_EVIDENCE.every((entry) => entry.fixture === "INT-FX-001")).toBe(true);
    expect(D1_FINAL_INTEGRATION_FIXTURES).toEqual(["INT-FX-001", "INT-FX-002", "INT-FX-003", "INT-FX-004"]);
  });

  describe("INT-FX-001 — canonical contract round trip", () => {
    it("uses deterministic canonical CBOR and exact F64Bits", () => {
      expect(DOCKING_CANONICALIZATION_PROFILE).toBe("ME_CANONICAL_CBOR_V1_1_0");
      expect(canonicalCborHex({ b: 1, a: 2 })).toBe("a2616102616201");
      expect(canonicalCborHex(f64Bits(0))).toBe("8263663634480000000000000000");
      expect(canonicalCborHex(f64Bits(-0))).toBe("8263663634488000000000000000");
      expect(canonicalCborHex(f64Bits(Number.MIN_VALUE))).toBe("8263663634480000000000000001");
      expect(Object.is(f64Value(f64Bits(-0)), -0)).toBe(true);
      expect(() => f64Bits(Number.NaN)).toThrowError(/finite/);
      expect(() => f64Bits(Number.POSITIVE_INFINITY)).toThrowError(/finite/);
    });

    it("round-trips a schema-governed scientific payload without insertion-order dependence", () => {
      const payload = {
        schemaVersion: 1,
        identity: "ligand-state",
        coordinates: [f64Bits(-0), f64Bits(1.25), f64Bits(Number.MIN_VALUE)],
        explicitNull: null,
      };
      const bytes = encodeCanonicalCbor(payload);
      const decoded = decodeCanonicalCbor(bytes);
      expect(encodeCanonicalCbor(decoded)).toEqual(bytes);
      expect(encodeCanonicalCbor({ explicitNull: null, coordinates: payload.coordinates, identity: "ligand-state", schemaVersion: 1 })).toEqual(bytes);
    });

    it("domain-separates SHA-256 scientific digests and preserves signed-zero identity", () => {
      const plus = scientificDigest<"CoordinateStateDigest">("COORDINATE_STATE", "COORDINATE_STATE_V1", { x: f64Bits(0) });
      const minus = scientificDigest<"CoordinateStateDigest">("COORDINATE_STATE", "COORDINATE_STATE_V1", { x: f64Bits(-0) });
      const otherClass = scientificDigest<"CoordinateStateDigest">("OTHER", "COORDINATE_STATE_V1", { x: f64Bits(0) });
      expect(plus).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(plus).not.toBe(minus);
      expect(plus).not.toBe(otherClass);
      expect(plus).toBe(scientificDigest<"CoordinateStateDigest">("COORDINATE_STATE", "COORDINATE_STATE_V1", { x: f64Bits(0) }));
    });

    it("keeps the workflow Configure → Preflight → Freeze → Run and profiles typed/versioned", () => {
      expect(DOCKING_WORKFLOW).toEqual(["CONFIGURE", "PREFLIGHT", "FREEZE", "RUN"]);
      expect(ORDINARY_V1_NON_OVERRIDABLE_OUTCOMES).toEqual(["INVALID", "AMBIGUOUS", "UNSUPPORTED", "RESOURCE_REJECTED"]);
      expect(SCIENTIFIC_PROFILE_IDS.scoring).toBe("ME_DOCKING_V1_VINA_CLASSIC_1_0");
      expect(SCIENTIFIC_PROFILE_IDS.numericalBackend).toBe("ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0");
      expect(SCIENTIFIC_PROFILE_IDS.campaignAggregation).toBe("ME_CAMP_AGG_STATE_SEPARATE_V1_1_0");
      expect(SCIENTIFIC_PROFILE_IDS.statePolicy).toBe("STATE_SEPARATE_NO_CANONICAL_SCORE_V1");
    });

    it("represents scientific identities separately and never makes PDBQT identity authority", () => {
      const molecularIdentity: MolecularIdentity = {
        schemaVersion: 1,
        semanticSchemaId: "MOLECULAR_IDENTITY_V1",
        molecularIdentityId: scientificId<"MolecularIdentityId">("mol:1"),
        digest: digest<"MolecularIdentityDigest">("1"),
        sourceArtifactRefs: [{ sourceArtifactId: scientificId<"SourceArtifactId">("source:1"), artifactByteDigest: digest<"ArtifactByteDigest">("2") }],
      };
      const region: SearchRegionRef = {
        kind: "SEARCH_REGION",
        scientificAuthority: "SCIENTIFIC_POSE_ADMISSIBILITY",
        searchRegionId: scientificId<"SearchRegionId">("region:1"),
        digest: digest<"SearchRegionDigest">("3"),
        receptorCoordinateFrame: "receptor-state:1",
      };
      const pdbqt: PdbqtExecutionRepresentationRef = {
        kind: "DERIVED_EXECUTION_REPRESENTATION",
        format: "PDBQT",
        sourceScientificDigest: molecularIdentity.digest,
        artifactByteDigest: digest<"ArtifactByteDigest">("4"),
        authoritativeForMolecularIdentity: false,
      };
      expect(region).not.toHaveProperty("camera");
      expect(pdbqt.authoritativeForMolecularIdentity).toBe(false);
      expect(pdbqt.sourceScientificDigest).toBe(molecularIdentity.digest);
    });

    it("keeps draft mutable/non-executable and frozen request immutable by contract shape", () => {
      const draft: DockingDraftRequestV1 = {
        schemaVersion: 1,
        draftId: scientificId<"DockingDraftRequestId">("draft:1"),
        taskType: scientificId<"DockingTaskType">("SITE_DIRECTED_NONCOVALENT_SMALL_MOLECULE_DOCKING"),
        receptorRef: { kind: "RECEPTOR_CANDIDATE", ref: "receptor" },
        ligandRef: { kind: "LIGAND_CANDIDATE", ref: "ligand" },
        siteProposal: { kind: "SITE_PROPOSAL", ref: "site" },
        profileSelection: {},
        seedPolicy: {},
        resourcePolicySelection: {},
        outputPolicySelection: {},
        provenancePolicy: {},
        status: "DRAFT",
        revision: 1,
      };
      draft.revision = 2;
      expect(draft.revision).toBe(2);

      const request: DockingRequestV1 = Object.freeze({
        schemaVersion: 1,
        requestId: scientificId<"DockingRequestId">("request:1"),
        taskType: draft.taskType,
        preparedReceptorDigest: digest<"PreparedReceptorDigest">("10"),
        preparedLigandDigest: digest<"PreparedLigandDigest">("11"),
        searchRegionDigest: digest<"SearchRegionDigest">("12"),
        scoringProfileDigest: digest<"ScoringProfileDigest">("13"),
        searchProfileDigest: digest<"SearchProfileDigest">("14"),
        rmsdProfileDigest: digest<"RmsdProfileDigest">("15"),
        plausibilityProfileDigest: digest<"PlausibilityProfileDigest">("16"),
        tieProfileDigest: digest<"TieProfileDigest">("17"),
        clusteringProfileDigest: digest<"ClusteringProfileDigest">("18"),
        finalModeProfileDigest: digest<"FinalModeProfileDigest">("19"),
        numericalBackendProfileDigest: digest<"NumericalBackendProfileDigest">("20"),
        resourcePolicyProfileDigest: digest<"ResourcePolicyProfileDigest">("21"),
        capabilityProfileDigest: digest<"CapabilityProfileDigest">("22"),
        validationProfileDigest: digest<"ValidationProfileDigest">("23"),
        rng: { algorithmProfile: SCIENTIFIC_PROFILE_IDS.rng, masterSeed: "seed:1", seedOrigin: "USER_SUPPLIED" as const },
        executionPolicy: { technicalRetryMaximum: 2 as const, cachePolicyDigest: digest<"CachePolicyDigest">("24") },
        resultPolicyDigest: digest<"ResultPolicyDigest">("25"),
        provenancePolicyDigest: digest<"ProvenancePolicyDigest">("26"),
        preflightReportDigest: digest<"PreflightReportDigest">("27"),
        parentDraftDigest: digest<"DockingDraftDigest">("28"),
        canonicalizationProfile: DOCKING_CANONICALIZATION_PROFILE,
        requestDigest: digest<"DockingRequestDigest">("29"),
      });
      expect(Object.isFrozen(request)).toBe(true);
      expect(request.executionPolicy.technicalRetryMaximum).toBe(2);
    });

    it("cannot synthesize a canonical numerical compound score in the V1 aggregate contract", () => {
      const aggregate: CompoundDockingAggregate = {
        compoundDockingAggregateId: scientificId<"CompoundDockingAggregateId">("aggregate:1"),
        digest: digest<"CompoundDockingAggregateDigest">("30"),
        molecularIdentityDigest: digest<"MolecularIdentityDigest">("30"),
        statePolicy: "STATE_SEPARATE_NO_CANONICAL_SCORE_V1",
        stateResultDigests: [digest<"StateDockingResultDigest">("31"), digest<"StateDockingResultDigest">("32")],
      };
      expect(aggregate).not.toHaveProperty("score");
      expect(aggregate).not.toHaveProperty("compoundScore");
      expect(aggregate.stateResultDigests).toHaveLength(2);
    });
  });

  describe("INT-FX-002 — six-state durable JobStatus guard", () => {
    it("preserves exactly the accepted six durable states", () => {
      expect(COMMAND_JOB_STATES).toEqual(["Created", "Queued", "Running", "Completed", "Failed", "Cancelled"]);
    });
  });

  describe("INT-FX-003 — orthogonal status guard", () => {
    it("keeps preflight/capability/result/backend/campaign states out of JobStatus", () => {
      const durable = new Set<string>(COMMAND_JOB_STATES);
      const orthogonal = [
        ...REQUEST_PREFLIGHT_STATUSES,
        ...CAPABILITY_ASSESSMENT_STATUSES,
        ...SCIENTIFIC_RESULT_STATUSES,
        ...BACKEND_VALIDATION_EQUIVALENCE_STATUSES,
        ...CAMPAIGN_COMPLETION_STATUSES,
        ...EXECUTION_EVENT_TYPES,
      ];
      expect(orthogonal.filter((status) => durable.has(status))).toEqual([]);
      expect(SCIENTIFIC_RESULT_STATUSES).toContain("COMPLETED_NO_ELIGIBLE_POSE");
      expect(REQUEST_PREFLIGHT_STATUSES).toContain("BLOCKED");
      expect(CAPABILITY_ASSESSMENT_STATUSES).toContain("UNSUPPORTED");
      expect(EXECUTION_EVENT_TYPES).toContain("CANCELLING");
    });
  });

  describe("INT-FX-004 — PDBQT authority guard and unavailable commands", () => {
    it("retains every required docking command name as fail-closed metadata", () => {
      const expected = [
        "DOCKING.PREPARE_RECEPTOR", "DOCKING.PREPARE_LIGAND", "DOCKING.DEFINE_SEARCH_SPACE", "DOCKING.CONFIGURE",
        "DOCKING.RUN", "DOCKING.STATUS", "DOCKING.CANCEL", "DOCKING.RESULTS.GET", "DOCKING.RESULTS.EXPORT",
        "DOCKING.PREFLIGHT", "DOCKING.FREEZE", "DOCKING.RETRY", "DOCKING.RERUN", "DOCKING.REPLAY",
      ];
      for (const name of expected) {
        expect(RESERVED_FUTURE_COMMAND_FAMILIES.docking).toContain(name);
        expect(RESERVED_FUTURE_COMMAND_METADATA[name]).toMatchObject({ capabilityState: "UNAVAILABLE", executable: false });
        expect(resolveCommand(name.toLowerCase())).toMatchObject({ error: "UNKNOWN_COMMAND" });
      }
      expect(RESERVED_FUTURE_COMMAND_FAMILIES.hts).toContain("HTS.SCREEN.RESUME");
      expect(RESERVED_FUTURE_COMMAND_METADATA["HTS.SCREEN.RESUME"]).toMatchObject({ capabilityState: "UNAVAILABLE", executable: false });
    });

    it("pins D1 repository architecture without creating the future native science kernel", () => {
      expect(DOCKING_REPOSITORY_ARCHITECTURE_V1).toEqual({
        contractsRoot: "packages/contracts/src/docking",
        apiRoot: "apps/api/src/docking",
        futureReferenceNativeRoot: "native/docking-reference",
        viewerSerializationAuthority: false,
        scientificCanonicalizationAuthority: "ME_CANONICAL_CBOR_V1_1_0",
        currentGate: "D1",
        nativeScienceKernelPresentInD1: false,
      });
    });

    it("retains bounded parser/input safety without a --force scientific bypass", () => {
      expect(isSafeCommandText("python print('x')")).toBe(false);
      expect(isSafeCommandText("show sticks, all")).toBe(true);
      expect(compileSafeCommand("load /etc/passwd").diagnostics).toEqual([]);
      const dispatcher = new CommandDispatcher();
      const pathResult = dispatcher.dispatch({ rawCommand: "load /etc/passwd" });
      expect(pathResult.status).toBe("FAILED");
      expect(pathResult.diagnostics.some((entry) => entry.code === "EXTERNAL_IO_REJECTED")).toBe(true);
      expect(resolveCommand("docking.run")).toMatchObject({ error: "UNKNOWN_COMMAND" });
    });

    it("keeps DOCKING.RUN non-executable through the dispatcher", () => {
      const dispatcher = new CommandDispatcher();
      const result = dispatcher.dispatch({ rawCommand: "docking.run" });
      expect(result.status).toBe("FAILED");
      expect(result.diagnostics.some((entry) => entry.code === "UNKNOWN_COMMAND" || entry.code === "UNSUPPORTED_CAPABILITY")).toBe(true);
      expect(dispatcher.listJobs()).toHaveLength(0);
    });
  });
});
