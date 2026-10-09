#!/usr/bin/env node
// Starts the full dev stack with the docking wizard pointed at the MOCK job server (5.0).
// Without VITE_DOCKING_MOCK=1 the wizard talks to the real API (task 5.7c); this script is the only way to get the
// mock. Every docking number it shows is fake and labelled MOCK in the UI.
//   node scripts/dev-docking-mock.mjs
import { spawn } from "node:child_process";

const MOCK_PORT = process.env.MOCK_JOBS_PORT ?? "8101";
const shell = process.platform === "win32";
const children = [];
const run = (cmd, args, env = {}) => {
  const child = spawn(cmd, args, { stdio: "inherit", shell, env: { ...process.env, ...env } });
  children.push(child);
  child.on("exit", (code) => { if (code) console.error(`${cmd} ${args.join(" ")} exited with ${code}`); });
  return child;
};

run("npx", ["tsx", "apps/api/src/jobs/mockServer.ts"], { MOCK_JOBS_PORT: MOCK_PORT });
run("npm", ["run", "dev"], { VITE_DOCKING_MOCK: "1", VITE_DOCKING_API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}` });

const stop = () => { for (const child of children) child.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
