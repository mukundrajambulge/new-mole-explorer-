import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DockResult, JobStatus, PrepJobStateV1, StructureLoadResult } from "@molecular/contracts";
import { apiClient } from "../lib/apiClient";
import { dockingClient as defaultClient, isAbortError, type DockingJobsClient } from "../lib/dockingClient";
import type { D2SearchRegionAuthority } from "./dockingApiAdapter";
import { numericSearchRegionDraft, type SearchRegionDraft } from "./dockingUiState";
import { SearchRegionEditor } from "./SearchRegionEditor";
import {
  WIZARD_STEPS, boxAroundAtoms, boxProblem, formatScore, hbondLines, isStaleForStructure, parsePoseAtoms, resultAsJson, rmsd, splitByRole, toJobArtifactId, ligandComponentId,
  type PoseAtom, type PoseOverlay, type WizardStep,
} from "./wizardLogic";

const POLL_MS = 500;
const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); }, { once: true });
});

export type DockingWizardProps = {
  structure: StructureLoadResult | null;
  sourceArtifactId: string | null;
  draft: SearchRegionDraft;
  coordinateFrame: string;
  committedRegion: D2SearchRegionAuthority | null;
  commitMessage: string | null;
  commitBusy: boolean;
  onDraftChange: (field: keyof SearchRegionDraft, value: string) => void;
  onReplaceDraft: (draft: SearchRegionDraft) => void;
  onShowDraft: () => void;
  onCommit: () => void;
  onPoseOverlay: (overlay: PoseOverlay | null) => void;
  onImport?: () => void;
  client?: DockingJobsClient;
};

type Uploaded = { artifactId: string; name: string };
type PoseTexts = { sdf?: string; pdbqt?: string };

const Err = ({ message }: { message: string | null }) => message ? <div className="docking-inline-diagnostic" role="alert" data-testid="wizard-error">{message}</div> : null;

export const DockingWizard = ({ structure, sourceArtifactId, draft, coordinateFrame, committedRegion, commitMessage, commitBusy, onDraftChange, onReplaceDraft, onShowDraft, onCommit, onPoseOverlay, onImport, client = defaultClient }: DockingWizardProps) => {
  const structureHash = structure?.structure.scientificHash ?? null;
  const hashRef = useRef<string | null>(structureHash);
  hashRef.current = structureHash;
  const controllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const [step, setStep] = useState<WizardStep>("Inputs");
  const [ligandKey, setLigandKey] = useState<string>("");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pH, setPH] = useState("7.4");
  const [protonation, setProtonation] = useState<"EXPLICIT_SUBMITTED" | "PROPKA_PREVIEW">("EXPLICIT_SUBMITTED");
  const [keepWaters, setKeepWaters] = useState(false);
  const [prep, setPrep] = useState<PrepJobStateV1 | null>(null);
  const [acks, setAcks] = useState<readonly string[]>([]);
  const [prepBusy, setPrepBusy] = useState(false);
  const [exhaustiveness, setExhaustiveness] = useState("8");
  const [numPoses, setNumPoses] = useState("9");
  const [seed, setSeed] = useState("1");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [result, setResult] = useState<DockResult | null>(null);
  const [poseTexts, setPoseTexts] = useState<Readonly<Record<number, PoseTexts>>>({});
  const [rmsdByRank, setRmsdByRank] = useState<Readonly<Record<number, number | null>>>({});
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [showHbonds, setShowHbonds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poseError, setPoseError] = useState<string | null>(null);

  const split = useMemo(() => (structure ? splitByRole(structure.structure) : null), [structure]);

  const resetAll = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    jobIdRef.current = null;
    setStep("Inputs"); setLigandKey(""); setUploaded(null); setPrep(null); setAcks([]); setPrepBusy(false); setJob(null); setRunBusy(false);
    setResult(null); setPoseTexts({}); setRmsdByRank({}); setSelectedRank(null); setError(null); setPoseError(null); setUploadBusy(false);
    onPoseOverlay(null);
  }, [onPoseOverlay]);

  // New structure: drop everything derived from the old one and abort its requests. Unmount aborts too.
  useEffect(() => { resetAll(); }, [structureHash, resetAll]);
  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  useEffect(() => {
    if (split && !ligandKey && !uploaded && split.ligands.length > 0) setLigandKey(split.ligands[0]!.key);
  }, [split, ligandKey, uploaded]);

  /** Starts a new request group. Returns the signal and a stale() check bound to the structure it was started for. */
  const begin = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedHash = hashRef.current ?? "";
    return { signal: controller.signal, stale: () => controller.signal.aborted || isStaleForStructure(requestedHash, hashRef.current), requestedHash };
  };

  const ligandCandidate = split?.ligands.find((l) => l.key === ligandKey) ?? null;
  const receptorId = sourceArtifactId ? toJobArtifactId(sourceArtifactId) : null;
  const ligandId = uploaded ? uploaded.artifactId : sourceArtifactId && ligandCandidate ? ligandComponentId(sourceArtifactId, ligandCandidate.key) : null;
  const inputsReady = Boolean(structure && receptorId && ligandId && split && split.receptor.atomCount > 0);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const { stale } = begin();
    setUploadBusy(true); setError(null);
    try {
      const loaded = await apiClient.uploadStructure(file);
      if (stale()) return;
      const id = loaded.sourceArtifact?.sourceArtifactId ?? loaded.structure.source.sourceArtifactId;
      if (!id) { setError("The uploaded ligand has no source artifact id, so it cannot be used."); return; }
      setUploaded({ artifactId: toJobArtifactId(id), name: file.name });
      setPrep(null);
    } catch (e) {
      if (!stale()) setError(errText(e, "Ligand upload failed."));
    } finally {
      if (!stale()) setUploadBusy(false);
    }
  };

  const planPrep = async () => {
    if (!receptorId || !ligandId) return;
    const pHNum = Number(pH);
    if (!Number.isFinite(pHNum) || pHNum < 0 || pHNum > 14) { setError("pH must be a number between 0 and 14."); return; }
    const { signal, stale } = begin();
    setPrepBusy(true); setError(null); setPrep(null); setAcks([]);
    try {
      const state = await client.planPrep({ receptorArtifactId: receptorId, ligandArtifactId: ligandId, pH: pHNum, protonation, keepWaters, ligandProtonation: "EXPLICIT_SUBMITTED", addMissingAtoms: false }, signal);
      if (!stale()) setPrep(state);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "Preparation planning failed."));
    } finally {
      if (!stale()) setPrepBusy(false);
    }
  };

  const needAcks = prep?.plan?.decisions.filter((d) => d.requiresAck).map((d) => d.key) ?? [];
  const acksComplete = needAcks.every((k) => acks.includes(k));

  const confirmPrep = async () => {
    const plan = prep?.plan;
    if (!prep || !plan) return;
    const { signal, stale } = begin();
    setPrepBusy(true); setError(null);
    try {
      let state = await client.confirmPrep({ jobId: prep.jobId, planDigest: plan.planDigest, acks: [...acks] }, signal);
      if (stale()) return;
      setPrep(state);
      while (state.state === "APPLYING") {
        await sleep(POLL_MS, signal);
        state = await client.getPrep(prep.jobId, signal);
        if (stale()) return;
        setPrep(state);
      }
      if (state.state === "FAILED" || state.state === "EXPIRED") setError(state.error ?? `Preparation ended in state ${state.state}.`);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "Preparation failed."));
    } finally {
      if (!stale()) setPrepBusy(false);
    }
  };

  const prepared = prep?.state === "SUCCEEDED" && prep.preparedReceptorId && prep.preparedLigandId ? { receptor: prep.preparedReceptorId, ligand: prep.preparedLigandId } : null;

  const useLigandBox = () => {
    const atoms = ligandCandidate?.atoms ?? [];
    const box = boxAroundAtoms(atoms);
    if (!box) { setError("No ligand atoms in this structure to center the box on. Enter the box by hand."); return; }
    setError(null);
    onReplaceDraft({ centerX: String(box.center[0]), centerY: String(box.center[1]), centerZ: String(box.center[2]), sizeX: String(box.size[0]), sizeY: String(box.size[1]), sizeZ: String(box.size[2]) });
  };

  const numericBox = numericSearchRegionDraft(draft);
  const boxMessage = numericBox ? boxProblem(numericBox.center, numericBox.size) : "Box values must be finite and greater than zero.";

  const loadPoses = async (res: DockResult, signal: AbortSignal, stale: () => boolean) => {
    const texts: Record<number, PoseTexts> = {};
    const atomsByRank: Record<number, readonly PoseAtom[]> = {};
    try {
      for (const pose of res.poses) {
        const text = await client.getPoseText(pose.poseArtifactId, "pdbqt", signal);
        if (stale()) return;
        texts[pose.rank] = { pdbqt: text };
        atomsByRank[pose.rank] = parsePoseAtoms(text, "pdbqt");
      }
    } catch (e) {
      if (!isAbortError(e) && !stale()) setPoseError(`Pose coordinates are not available, so RMSD and the overlay cannot be shown: ${errText(e, "download failed")}`);
      if (stale()) return;
    }
    const best = res.poses.slice().sort((a, b) => a.rank - b.rank)[0];
    const bestAtoms = best ? atomsByRank[best.rank] : undefined;
    const out: Record<number, number | null> = {};
    for (const pose of res.poses) out[pose.rank] = bestAtoms && atomsByRank[pose.rank] ? rmsd(bestAtoms, atomsByRank[pose.rank]!) : null;
    setPoseTexts(texts);
    setRmsdByRank(out);
  };

  const run = async () => {
    if (!prepared || !numericBox || boxMessage) return;
    const ex = Number(exhaustiveness), np = Number(numPoses), sd = Number(seed);
    if (!Number.isInteger(ex) || ex < 1 || ex > 64) { setError("Exhaustiveness must be a whole number from 1 to 64."); return; }
    if (!Number.isInteger(np) || np < 1 || np > 20) { setError("Number of poses must be a whole number from 1 to 20."); return; }
    if (!Number.isInteger(sd) || sd < 0 || sd > 2_147_483_647) { setError("Seed must be a whole number from 0 to 2147483647."); return; }
    const { signal, stale } = begin();
    setRunBusy(true); setError(null); setPoseError(null); setResult(null); setJob(null); setSelectedRank(null); onPoseOverlay(null);
    try {
      let status = await client.startJob({ receptorPreparedId: prepared.receptor, ligandPreparedId: prepared.ligand, boxCenter: [...numericBox.center], boxSize: [...numericBox.size], exhaustiveness: ex, numPoses: np, seed: sd }, signal);
      if (stale()) return;
      jobIdRef.current = status.jobId;
      setJob(status);
      setStep("Run");
      while (!TERMINAL.has(status.status)) {
        await sleep(POLL_MS, signal);
        status = await client.getJob(status.jobId, signal);
        if (stale()) return;
        setJob(status);
      }
      if (status.status === "FAILED") { setError(status.error ?? "The docking job failed without a message."); return; }
      if (status.status === "CANCELLED") return;
      const res = await client.getResult(status.jobId, signal);
      if (stale()) return;
      setResult(res);
      setStep("Results");
      await loadPoses(res, signal, stale);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "The docking run failed."));
    } finally {
      if (!stale()) setRunBusy(false);
    }
  };

  const cancel = async () => {
    const id = jobIdRef.current;
    if (!id) return;
    controllerRef.current?.abort(); // stop polling; the cancel call uses its own signal
    const cancelController = new AbortController();
    try {
      const status = await client.cancelJob(id, cancelController.signal);
      if (hashRef.current !== null) setJob(status);
    } catch (e) {
      setError(errText(e, "Cancel failed."));
    } finally {
      setRunBusy(false);
    }
  };

  const selectPose = (rank: number) => {
    setSelectedRank(rank);
    setPoseError(null);
    const text = poseTexts[rank]?.pdbqt;
    if (!text || !structureHash) { onPoseOverlay(null); setPoseError("No coordinates are available for this pose, so it cannot be overlaid."); return; }
    const atoms = parsePoseAtoms(text, "pdbqt");
    if (atoms.length === 0) { onPoseOverlay(null); setPoseError("The pose file could not be parsed; nothing was overlaid."); return; }
    onPoseOverlay({ rank, format: "pdbqt", text, hbonds: showHbonds && structure ? hbondLines(atoms, structure.structure.atoms) : [], structureHash });
  };
  const toggleHbonds = (on: boolean) => {
    setShowHbonds(on);
    const text = selectedRank === null ? undefined : poseTexts[selectedRank]?.pdbqt;
    if (!text || selectedRank === null || !structure || !structureHash) return;
    const atoms = parsePoseAtoms(text, "pdbqt");
    onPoseOverlay({ rank: selectedRank, format: "pdbqt", text, hbonds: on ? hbondLines(atoms, structure.structure.atoms) : [], structureHash });
  };

  const save = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const downloadPose = async (format: "sdf" | "pdbqt") => {
    if (selectedRank === null || !result) return;
    const pose = result.poses.find((p) => p.rank === selectedRank);
    if (!pose) return;
    const { signal, stale } = begin();
    try {
      const text = poseTexts[selectedRank]?.[format] ?? await client.getPoseText(pose.poseArtifactId, format, signal);
      if (!stale()) save(`pose-${selectedRank}.${format}`, text, "chemical/x-" + format);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setPoseError(`Download failed: ${errText(e, "unavailable")}`);
    }
  };

  const mock = client.isMock || Boolean(prep?.plan?.warnings.some((w) => /mock/i.test(w))) || Boolean(result?.poses.some((p) => p.poseArtifactId.startsWith("mock-")));
  const reached = (s: WizardStep): boolean => s === "Inputs" || (s === "Prepare" && inputsReady) || (s === "Box" && Boolean(prepared)) || (s === "Run" && Boolean(prepared) && !boxMessage) || (s === "Results" && Boolean(result));
  const sortedPoses = result ? result.poses.slice().sort((a, b) => a.rank - b.rank) : [];

  return (
    <section className="docking-card docking-wizard" aria-label="Docking wizard" data-testid="docking-wizard">
      <div className="docking-preview-banner" role="note" data-testid="docking-preview-banner"><strong>Preview: not scientifically qualified.</strong> Scores are for exploration and must not be used as evidence.{mock && <span className="docking-mock-label" data-testid="docking-mock-label"> MOCK SERVER: all numbers are fake test data, not docking results.</span>}</div>
      <ol className="docking-wizard-steps" aria-label="Docking steps">
        {WIZARD_STEPS.map((s, i) => <li key={s}><button type="button" aria-current={s === step ? "step" : undefined} data-testid={`wizard-step-${s.toLowerCase()}`} disabled={!reached(s)} onClick={() => { setError(null); setStep(s); }}>{i + 1}. {s}</button></li>)}
      </ol>
      <Err message={error} />

      {step === "Inputs" && <div data-testid="wizard-inputs">
        {!structure || !split ? <p className="docking-help">Import a structure first.{onImport && <> <button type="button" onClick={onImport}>Import structure</button></>}</p> : <>
          <div className="docking-state-row" data-testid="wizard-receptor"><span>Receptor (polymer)</span><strong>{split.receptor.atomCount > 0 ? `${split.receptor.atomCount.toLocaleString("en-US")} atoms · chains ${split.receptor.chains.join(", ")}` : "No polymer atoms found"}</strong></div>
          <label className="docking-field"><span>Ligand</span>
            <select aria-label="Ligand" value={uploaded ? "__upload" : ligandKey} onChange={(e) => { if (e.target.value !== "__upload") { setUploaded(null); setLigandKey(e.target.value); setPrep(null); } }}>
              {split.ligands.map((l) => <option key={l.key} value={l.key}>{l.label} · {l.atomCount} atoms (from structure)</option>)}
              {uploaded && <option value="__upload">{uploaded.name} (uploaded)</option>}
              {split.ligands.length === 0 && !uploaded && <option value="">No ligand in structure; upload one</option>}
            </select></label>
          <label className="docking-field"><span>Or upload a separate ligand file</span><input type="file" aria-label="Upload ligand file" accept=".sdf,.mol,.mol2,.pdb,.pdbqt,.cif" disabled={uploadBusy} onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ""; }} /></label>
          {uploadBusy && <p role="status">Uploading ligand…</p>}
          {!sourceArtifactId && <p className="docking-help" role="status">Waiting for the source artifact id from the D2 adapter.</p>}
          <div className="docking-region-actions"><button className="docking-primary-action" type="button" disabled={!inputsReady} onClick={() => setStep("Prepare")}>Next: Prepare</button></div>
        </>}
      </div>}

      {step === "Prepare" && <div data-testid="wizard-prepare">
        <div className="docking-region-grid">
          <label><span>pH</span><input aria-label="pH" type="number" step="0.1" min="0" max="14" value={pH} onChange={(e) => { setPH(e.target.value); setPrep(null); }} /></label>
          <label><span>Protonation</span><select aria-label="Protonation" value={protonation} onChange={(e) => { setProtonation(e.target.value as typeof protonation); setPrep(null); }}><option value="EXPLICIT_SUBMITTED">Use submitted hydrogens</option><option value="PROPKA_PREVIEW">PROPKA estimate (preview)</option></select></label>
          <label><span>Keep waters</span><input aria-label="Keep waters" type="checkbox" checked={keepWaters} onChange={(e) => { setKeepWaters(e.target.checked); setPrep(null); }} /></label>
        </div>
        <div className="docking-region-actions"><button type="button" disabled={prepBusy || !inputsReady} onClick={() => void planPrep()}>{prepBusy && !prep ? "Planning…" : "Prepare"}</button></div>
        {prep?.plan && <div className="docking-card" data-testid="prep-report">
          <h3>Preparation report</h3>
          <div className="docking-state-row"><span>pH / protonation</span><strong>{prep.plan.pH} · {prep.plan.protonationSource}</strong></div>
          <div className="docking-state-row"><span>Charge model / tautomer</span><strong>{prep.plan.chargeModel} · {prep.plan.tautomer}</strong></div>
          <div className="docking-state-row"><span>Rotatable bonds</span><strong>{prep.plan.rotatableBonds}</strong></div>
          <ul>{prep.plan.decisions.map((d) => <li key={d.key}><strong>{d.key}</strong>: {d.choice} ({d.atomsBefore} to {d.atomsAfter} atoms){d.requiresAck && <label> <input type="checkbox" aria-label={`Acknowledge ${d.key}`} checked={acks.includes(d.key)} onChange={(e) => setAcks((cur) => e.target.checked ? [...cur, d.key] : cur.filter((k) => k !== d.key))} /> I accept this</label>}</li>)}</ul>
          {prep.plan.warnings.map((w) => <div className="docking-diagnostic docking-diagnostic--warning" key={w}>{w}</div>)}
          <div className="docking-state-row"><span>State</span><strong data-testid="prep-state">{prep.state}</strong></div>
          <div className="docking-region-actions">
            <button className="docking-primary-action" type="button" data-testid="prep-confirm" disabled={prepBusy || prep.state !== "AWAITING_CONFIRMATION" || !acksComplete} onClick={() => void confirmPrep()}>{prepBusy ? "Working…" : "Confirm"}</button>
            <button type="button" disabled={!prepared} onClick={() => setStep("Box")}>Next: Box</button>
          </div>
        </div>}
      </div>}

      {step === "Box" && <div data-testid="wizard-box">
        <SearchRegionEditor draft={draft} coordinateFrame={coordinateFrame} committedRegion={committedRegion} commitMessage={commitMessage} commitBusy={commitBusy} onDraftChange={onDraftChange} onShowDraft={onShowDraft} onCommit={onCommit} />
        <div className="docking-region-actions"><button type="button" disabled={!ligandCandidate} title={ligandCandidate ? undefined : "Needs a ligand that is part of the loaded structure"} onClick={useLigandBox}>Box around ligand</button><button className="docking-primary-action" type="button" disabled={Boolean(boxMessage)} onClick={() => setStep("Run")}>Next: Run</button></div>
        <Err message={boxMessage} />
      </div>}

      {step === "Run" && <div data-testid="wizard-run">
        <div className="docking-region-grid">
          <label><span>Exhaustiveness (1-64)</span><input aria-label="Exhaustiveness" type="number" min="1" max="64" value={exhaustiveness} disabled={runBusy} onChange={(e) => setExhaustiveness(e.target.value)} /></label>
          <label><span>Poses (1-20)</span><input aria-label="Number of poses" type="number" min="1" max="20" value={numPoses} disabled={runBusy} onChange={(e) => setNumPoses(e.target.value)} /></label>
          <label><span>Seed</span><input aria-label="Seed" type="number" min="0" value={seed} disabled={runBusy} onChange={(e) => setSeed(e.target.value)} /></label>
        </div>
        <div className="docking-region-actions">
          <button className="docking-primary-action" type="button" data-testid="run-start" disabled={runBusy || !prepared || Boolean(boxMessage)} onClick={() => void run()}>{runBusy ? "Running…" : "Run docking"}</button>
          <button type="button" data-testid="run-cancel" disabled={!runBusy || !job || TERMINAL.has(job.status)} onClick={() => void cancel()}>Cancel</button>
        </div>
        {job && <div data-testid="run-status"><progress aria-label="Docking progress" max={1} value={job.progress} /> <span>{job.status} · {Math.round(job.progress * 100)}%{job.message ? ` · ${job.message}` : ""}</span></div>}
        {job?.status === "CANCELLED" && <p role="status">Job cancelled. No results were produced.</p>}
        <Err message={boxMessage} />
      </div>}

      {step === "Results" && result && <div data-testid="wizard-results">
        <p className="docking-help">Score status: <strong>{result.scoreStatus}</strong>. {result.scoreStatus !== "QUALIFIED" && "These numbers are not scientifically qualified."}</p>
        <table className="docking-results-table" data-testid="results-table">
          <thead><tr><th>Rank</th><th title="not a binding free energy">Vina score (empirical, lower is better)</th><th title="not a binding free energy">ME score (empirical)</th><th>RMSD to best</th></tr></thead>
          <tbody>{sortedPoses.map((p) => <tr key={p.rank} aria-selected={p.rank === selectedRank} data-testid={`pose-row-${p.rank}`} onClick={() => selectPose(p.rank)} style={{ cursor: "pointer", fontWeight: p.rank === selectedRank ? 700 : 400 }}><td>{p.rank}</td><td>{formatScore(p.vinaScore)}</td><td>{formatScore(p.meScore)}</td><td>{rmsdByRank[p.rank] == null ? "n/a" : rmsdByRank[p.rank]!.toFixed(2)}</td></tr>)}</tbody>
        </table>
        {sortedPoses.length === 0 && <p role="status">The job finished but returned no poses.</p>}
        <label><input type="checkbox" aria-label="Show H-bond lines" checked={showHbonds} onChange={(e) => toggleHbonds(e.target.checked)} /> Show H-bond lines (N/O pairs within 3.5 Å, distance only)</label>
        <div className="docking-region-actions">
          <button type="button" disabled={selectedRank === null} onClick={() => void downloadPose("sdf")}>Download SDF</button>
          <button type="button" disabled={selectedRank === null} onClick={() => void downloadPose("pdbqt")}>Download PDBQT</button>
          <button type="button" onClick={() => save(`docking-${result.jobId}.json`, resultAsJson(result, mock, rmsdByRank), "application/json")}>Download JSON</button>
        </div>
        <Err message={poseError} />
      </div>}
    </section>
  );
};
