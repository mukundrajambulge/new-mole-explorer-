import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type ProfileDetails = Readonly<Record<string, unknown>>;

const profilePath = process.env.MOLEXPLORER_INGESTION_PROFILE_PATH;
const startedAt = performance.now();

const writeProfileEvent = (event: Record<string, unknown>): void => {
  if (!profilePath) return;
  try {
    mkdirSync(dirname(profilePath), { recursive: true });
    appendFileSync(profilePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Profiling must never make ingestion fail.
  }
};

export const profileMark = (stage: string, phase: "START" | "END" | "FAIL" | "INFO", details: ProfileDetails = {}): void => {
  if (!profilePath) return;
  const memory = process.memoryUsage();
  writeProfileEvent({
    kind: "INGESTION_STAGE",
    stage,
    phase,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
    ...details,
  });
};

export const profileSync = <T>(stage: string, operation: () => T, details: ProfileDetails = {}): T => {
  profileMark(stage, "START", details);
  try {
    const result = operation();
    profileMark(stage, "END", details);
    return result;
  } catch (error) {
    profileMark(stage, "FAIL", { ...details, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};

export const profileTransport = (phase: "START" | "END", details: ProfileDetails = {}): void => profileMark("API_RESPONSE_PREP", phase, details);
