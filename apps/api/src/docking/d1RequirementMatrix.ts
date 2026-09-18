export const D1_REQUIREMENT_IDS = [
  "ME-DCK-V1-REQ-0013", "ME-DCK-V1-REQ-0014", "ME-DCK-V1-REQ-0015", "ME-DCK-V1-REQ-0016",
  "ME-DCK-V1-REQ-0017", "ME-DCK-V1-REQ-0018", "ME-DCK-V1-REQ-0019", "ME-DCK-V1-REQ-0020",
  "ME-DCK-V1-REQ-0021", "ME-DCK-V1-REQ-0022", "ME-DCK-V1-REQ-0023", "ME-DCK-V1-REQ-0024",
  "ME-DCK-V1-REQ-0025", "ME-DCK-V1-REQ-0026", "ME-DCK-V1-REQ-0027", "ME-DCK-V1-REQ-0028",
  "ME-DCK-V1-REQ-0223", "ME-DCK-V1-REQ-0224", "ME-DCK-V1-REQ-0225", "ME-DCK-V1-REQ-0226",
  "ME-DCK-V1-REQ-0227", "ME-DCK-V1-REQ-0228", "ME-DCK-V1-REQ-0229", "ME-DCK-V1-REQ-0230",
  "ME-DCK-V1-REQ-0231", "ME-DCK-V1-REQ-0232", "ME-DCK-V1-REQ-0233", "ME-DCK-V1-REQ-0234",
  "ME-DCK-V1-REQ-0235", "ME-DCK-V1-REQ-0236", "ME-DCK-V1-REQ-0237", "ME-DCK-V1-REQ-0238",
  "ME-DCK-V1-REQ-0239", "ME-DCK-V1-REQ-0240", "ME-DCK-V1-REQ-0241", "ME-DCK-V1-REQ-0242",
  "ME-DCK-V1-REQ-0260", "ME-DCK-V1-REQ-0278", "ME-DCK-V1-REQ-0279", "ME-DCK-V1-REQ-0280",
] as const;

export type D1RequirementId = (typeof D1_REQUIREMENT_IDS)[number];

export type D1RequirementEvidence = Readonly<{
  requirementId: D1RequirementId;
  acceptanceTestId: string;
  targetModule: string;
  fixture: "INT-FX-001" | "INT-FX-002" | "INT-FX-003" | "INT-FX-004";
}>;

const moduleFor = (requirementId: D1RequirementId): string => {
  const numeric = Number(requirementId.slice(-4));
  if (numeric >= 13 && numeric <= 28) return "packages/contracts/src/docking";
  if (numeric >= 223 && numeric <= 242) return "packages/contracts/src/docking + apps/api/src/command";
  if (numeric === 260) return "repository architecture";
  return "implementation governance";
};

export const D1_FINAL_INTEGRATION_FIXTURES = ["INT-FX-001", "INT-FX-002", "INT-FX-003", "INT-FX-004"] as const;

export const D1_REQUIREMENT_EVIDENCE: readonly D1RequirementEvidence[] = D1_REQUIREMENT_IDS.map((requirementId) => ({
  requirementId,
  acceptanceTestId: requirementId.replace("-REQ-", "-AT-"),
  targetModule: moduleFor(requirementId),
  fixture: "INT-FX-001",
}));
