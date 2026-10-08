import { fileURLToPath } from "node:url";

export type ApiConfig = {
  mode: "local" | "hosted";
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  /** Directory that receives the local-mode token file (<dir>/token). */
  tokenDir: string;
  /** Cap for ordinary JSON bodies. */
  maxJsonBytes: number;
  /** Cap for project save bodies (PUT /api/projects/:id). */
  maxProjectJsonBytes: number;
  /** Total JSON body bytes held at once across all requests; more answer 429. */
  maxJsonBytesInFlight: number;
  /** Cap for one uploaded or remotely fetched structure file. */
  maxUploadBytes: number;
  /** Uploads handled at the same time; more answer 429. */
  maxConcurrentUploads: number;
};

const MIB = 1024 * 1024;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_DEV_ORIGINS = ["http://localhost:3101", "http://127.0.0.1:3101"];

const intEnv = (env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number => {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ApiConfig => {
  const modeRaw = env.MOLE_MODE ?? "local";
  if (modeRaw !== "local" && modeRaw !== "hosted") throw new Error("MOLE_MODE must be local or hosted.");
  const host = env.HOST || "127.0.0.1";
  if (modeRaw === "local" && !LOOPBACK.has(host)) throw new Error("MOLE_MODE=local only binds to a loopback address; set MOLE_MODE=hosted to expose the server.");
  const listed = (env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (modeRaw === "hosted" && listed.length === 0) throw new Error("MOLE_MODE=hosted requires ALLOWED_ORIGINS.");
  if (listed.includes("*")) throw new Error("ALLOWED_ORIGINS must list explicit origins, not *.");
  const maxJsonBytes = intEnv(env, "MAX_JSON_BYTES", 8 * MIB, 1024, 256 * MIB);
  const maxProjectJsonBytes = intEnv(env, "MAX_PROJECT_JSON_BYTES", 64 * MIB, 1024, 256 * MIB);
  // Default budget fits two maximum project saves at once; a parsed body costs a few times its bytes.
  const maxJsonBytesInFlight = intEnv(env, "MAX_JSON_BYTES_IN_FLIGHT", 2 * maxProjectJsonBytes, Math.max(maxJsonBytes, maxProjectJsonBytes), 1024 * MIB);
  return {
    mode: modeRaw,
    host,
    port: intEnv(env, "PORT", intEnv(env, "API_PORT", 8100, 0, 65535), 0, 65535),
    allowedOrigins: modeRaw === "local" ? [...LOCAL_DEV_ORIGINS, ...listed] : listed,
    tokenDir: env.MOLE_TOKEN_DIR || fileURLToPath(new URL("../../../.mole", import.meta.url)),
    maxJsonBytes,
    maxProjectJsonBytes,
    maxJsonBytesInFlight,
    // Parsers still need the decoded text as one string (streamed in, never a whole-file Buffer); keep it far below V8's ~512 Mi-char limit.
    maxUploadBytes: intEnv(env, "MAX_UPLOAD_BYTES", 256 * MIB, 1024, 384 * MIB),
    maxConcurrentUploads: intEnv(env, "MAX_CONCURRENT_UPLOADS", 2, 1, 16),
  };
};
