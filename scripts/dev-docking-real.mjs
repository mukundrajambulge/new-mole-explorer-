#!/usr/bin/env node
// Starts the dev stack with real docking switched on: the wizard runs pinned AutoDock Vina 1.2.7 in WSL
// through the job runner. This is the separate capability VINA_COMPARATOR_PREVIEW (EXPERIMENTAL,
// implemented but not verified or evaluated); DOCKING.RUN (the Mole engine) stays UNAVAILABLE.
//   node scripts/dev-docking-real.mjs
import { spawn } from "node:child_process";

const child = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, FEATURE_DOCKING_RUN: "1" } });
const stop = () => { child.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
