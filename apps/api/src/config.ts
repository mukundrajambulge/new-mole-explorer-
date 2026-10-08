import { fileURLToPath } from "node:url";

export type ApiConfig = {
  mode: "local" | "hosted";
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  /** Directory that receives the local-mode token file (<dir>/token). */
  tokenDir: string;
  /** Shared credential for hosted mode (MOLE_TOKEN) until accounts exist; local mode issues a random token. */
  token?: string;
  maxJsonBytes: number;
  maxUploadBytes: number;
};

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
  const token = env.MOLE_TOKEN;
  if (modeRaw === "hosted" && (token === undefined || token.length < 32)) throw new Error("MOLE_MODE=hosted requires MOLE_TOKEN of at least 32 characters.");
  if (listed.includes("*")) throw new Error("ALLOWED_ORIGINS must list explicit origins, not *.");
  return {
    mode: modeRaw,
    host,
    port: intEnv(env, "PORT", intEnv(env, "API_PORT", 8100, 0, 65535), 0, 65535),
    allowedOrigins: modeRaw === "local" ? [...LOCAL_DEV_ORIGINS, ...listed] : listed,
    tokenDir: env.MOLE_TOKEN_DIR || fileURLToPath(new URL("../../../.mole", import.meta.url)),
    ...(modeRaw === "hosted" ? { token } : {}),
    maxJsonBytes: intEnv(env, "MAX_JSON_BYTES", 8 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    maxUploadBytes: intEnv(env, "MAX_UPLOAD_BYTES", 512 * 1024 * 1024 + 1_000_000, 1024, 4 * 1024 * 1024 * 1024),
  };
};
