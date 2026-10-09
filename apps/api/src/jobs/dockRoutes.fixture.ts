import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrepJobStateV1 } from "@molecular/contracts";

// Test support for the docking job routes (task 5.5): real tests/fixtures PDBQTs, a prep job dir exactly as
// PrepJobStore persists it, and a small SSE client over fetch.
const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, "../../../..");
const fx = join(REPO, "tests", "fixtures");
export const REC = readFileSync(join(fx, "multitype-receptor.pdbqt"));
export const LIG = readFileSync(join(fx, "dock", "1STP-BTN-ligand.pdbqt"));
export const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export type PreparedIds = { receptorPreparedId: string; ligandPreparedId: string };

/** A SUCCEEDED prep job dir (manifest + seal) under prepRoot; returns its server-minted prepared ids. */
export const seedPrepJob = (prepRoot: string, seal: "SEALED" | "PREVIEW_UNQUALIFIED" | "BLOCKED", jobId: string): PreparedIds => {
  const dir = join(prepRoot, jobId);
  mkdirSync(join(dir, "out"), { recursive: true });
  writeFileSync(join(dir, "out", "receptor.pdbqt"), REC);
  writeFileSync(join(dir, "out", "ligand.pdbqt"), LIG);
  const compact = jobId.replace(/-/g, "");
  const t = new Date().toISOString();
  const state: PrepJobStateV1 = {
    schemaVersion: 1,
    jobId,
    state: "SUCCEEDED",
    manifest: {
      schemaVersion: 1,
      jobId,
      status: "PREPARED",
      stages: [],
      outputs: [
        { role: "RECEPTOR_PDBQT", relPath: "out/receptor.pdbqt", sha256: sha(REC), bytes: REC.length },
        { role: "LIGAND_PDBQT", relPath: "out/ligand.pdbqt", sha256: sha(LIG), bytes: LIG.length },
      ],
      diagnostics: [],
    },
    seal: { status: seal, qualification: seal === "SEALED" ? "INTERIM" : "PREVIEW_UNQUALIFIED", reasonCodes: [], verifiedOutputs: 2 },
    ...(seal === "SEALED" ? { preparedReceptorId: `prec_${compact}`, preparedLigandId: `plig_${compact}` } : {}),
    ...(seal === "PREVIEW_UNQUALIFIED" ? { previewReceptorId: `pvrec_${compact}_${"ab".repeat(12)}`, previewLigandId: `pvlig_${compact}_${"cd".repeat(12)}` } : {}),
    createdAt: t,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    updatedAt: t,
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state));
  if (seal === "PREVIEW_UNQUALIFIED") return { receptorPreparedId: state.previewReceptorId!, ligandPreparedId: state.previewLigandId! };
  return { receptorPreparedId: `prec_${compact}`, ligandPreparedId: `plig_${compact}` };
};

/** The 1STP biotin pocket box used by the 5.4 tests (exhaustiveness 1: a tiny job). */
export const dockRequest = (ids: PreparedIds, extra: Record<string, unknown> = {}) => ({ ...ids, boxCenter: [11.4, 2.4, -11.4], boxSize: [22, 22, 22], exhaustiveness: 1, numPoses: 3, seed: 42, ...extra });

export type SseEvent = { id: number; event: string; data: Record<string, unknown> };
export type SseRead = { status: number; contentType: string; events: SseEvent[]; comments: string[]; ended: boolean; body?: Record<string, unknown> };

/**
 * Reads an SSE stream until the server closes it (ended: true), `until` holds, or `ms` elapses; then aborts.
 * Non-200 answers are returned with their JSON body.
 */
export const readSse = async (
  url: string,
  headers: Record<string, string>,
  o: { until?: (events: SseEvent[], comments: string[]) => boolean; ms?: number } = {},
): Promise<SseRead> => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), o.ms ?? 15_000);
  const out: SseRead = { status: 0, contentType: "", events: [], comments: [], ended: false };
  try {
    const r = await fetch(url, { headers, signal: ac.signal });
    out.status = r.status;
    out.contentType = r.headers.get("content-type") ?? "";
    if (r.status !== 200) {
      out.body = (await r.json()) as Record<string, unknown>;
      return out;
    }
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        out.ended = true;
        break;
      }
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev: Partial<SseEvent> = {};
        for (const line of block.split("\n")) {
          if (line.startsWith(":")) out.comments.push(line.slice(1).trim());
          else if (line.startsWith("id: ")) ev.id = Number(line.slice(4));
          else if (line.startsWith("event: ")) ev.event = line.slice(7);
          else if (line.startsWith("data: ")) ev.data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        }
        if (ev.data) out.events.push(ev as SseEvent);
      }
      if (o.until?.(out.events, out.comments)) {
        ac.abort();
        break;
      }
    }
  } catch (e) {
    if (!(e instanceof Error && e.name === "AbortError")) throw e;
  } finally {
    clearTimeout(timer);
  }
  return out;
};

export const statuses = (events: SseEvent[]) => events.filter((e) => e.event === "status").map((e) => e.data.status);
