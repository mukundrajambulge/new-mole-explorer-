import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOCK_SCORE_LABEL, type PrepJobStateV1, type StructureLoadResult } from "@molecular/contracts";
import { dockingClient as defaultClient, isAbortError, isTerminal, type DockingCapabilities, type DockingJobsClient, type DownloadName, type WatchMode, type WizardJob, type WizardResult } from "../lib/dockingClient";
import type { D2SearchRegionAuthority } from "./dockingApiAdapter";
import { numericSearchRegionDraft, type SearchRegionDraft } from "./dockingUiState";
import { SearchRegionEditor } from "./SearchRegionEditor";
import { VINA_EXPERIMENTAL_BANNER, prepBlockReason, preparedIds } from "./wizardPrepGate";
import {
  WIZARD_STEPS, boxAroundAtoms, boxProblem, formatScore, hbondLines, isStaleForStructure, ligandPdbFromAtoms, parsePoseAtoms, prepFormatForFile, rmsd, splitByRole,
  type PoseAtom, type PoseOverlay, type WizardStep,
} from "./wizardLogic";

const POLL_MS = 500;
const SMILES_MAX = 2000;
const ENABLE_HINT = "To enable it, start the API with FEATURE_DOCKING_RUN=1 (needs WSL Ubuntu-24.04 with the pinned Vina 1.2.7 and the prep environment).";
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

type UploadedLigand = { file: File; name: string; format: "pdb" | "sdf" | "mol" | "mol2" };

const Err = ({ message, testId = "wizard-error" }: { message: string | null; testId?: string }) => message ? <div className="docking-inline-diagnostic" role="alert" data-testid={testId}>{message}</div> : null;

export const DockingWizard = ({ structure, sourceArtifactId, draft, coordinateFrame, committedRegion, commitMessage, commitBusy, onDraftChange, onReplaceDraft, onShowDraft, onCommit, onPoseOverlay, onImport, client = defaultClient }: DockingWizardProps) => {
  const structureHash = structure?.structure.scientificHash ?? null;
  const hashRef = useRef<string | null>(structureHash);
  hashRef.current = structureHash;
  const controllerRef = useRef<AbortController | null>(null);
  const auxRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const [caps, setCaps] = useState<DockingCapabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>("Inputs");
  const [ligandKey, setLigandKey] = useState<string>("");
  const [uploaded, setUploaded] = useState<UploadedLigand | null>(null);
  const [templateSmiles, setTemplateSmiles] = useState("");
  const [pH, setPH] = useState("7.4");
  const [protonation, setProtonation] = useState<"EXPLICIT_SUBMITTED" | "PROPKA_PREVIEW">("EXPLICIT_SUBMITTED");
  const [keepWaters, setKeepWaters] = useState(false);
  const [prep, setPrep] = useState<PrepJobStateV1 | null>(null);
  const [acks, setAcks] = useState<readonly string[]>([]);
  const [prepBusy, setPrepBusy] = useState<string | null>(null);
  const [exhaustiveness, setExhaustiveness] = useState("8");
  const [numPoses, setNumPoses] = useState("9");
  const [seed, setSeed] = useState("1");
  const [job, setJob] = useState<WizardJob | null>(null);
  const [watchMode, setWatchMode] = useState<{ mode: WatchMode; reason?: string } | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [poseTexts, setPoseTexts] = useState<Readonly<Record<number, string>>>({});
  const [posesLoading, setPosesLoading] = useState(false);
  const [rmsdByRank, setRmsdByRank] = useState<Readonly<Record<number, number | null>>>({});
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [showHbonds, setShowHbonds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poseError, setPoseError] = useState<string | null>(null);

  const split = useMemo(() => (structure ? splitByRole(structure.structure) : null), [structure]);

  // Capability negotiation (5.6): read once per mount; no mock fallback in real mode.
  useEffect(() => {
    const controller = new AbortController();
    client.getCapabilities(controller.signal).then(
      (c) => { if (!controller.signal.aborted) setCaps(c); },
      (e: unknown) => { if (!isAbortError(e) && !controller.signal.aborted) setCapsError(`Docking capability could not be read, so docking stays disabled: ${errText(e, "unknown error")}`); },
    );
    return () => controller.abort();
  }, [client]);

  const resetAll = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    auxRef.current?.abort();
    auxRef.current = null;
    jobIdRef.current = null;
    setStep("Inputs"); setLigandKey(""); setUploaded(null); setPrep(null); setAcks([]); setPrepBusy(null); setJob(null); setRunBusy(false); setCancelBusy(false); setWatchMode(null);
    setResult(null); setPoseTexts({}); setPosesLoading(false); setRmsdByRank({}); setSelectedRank(null); setError(null); setPoseError(null);
    onPoseOverlay(null);
  }, [onPoseOverlay]);

  // New structure: drop everything derived from the old one and abort its requests. Unmount aborts too.
  useEffect(() => { resetAll(); }, [structureHash, resetAll]);
  useEffect(() => () => { controllerRef.current?.abort(); auxRef.current?.abort(); }, []);

  useEffect(() => {
    if (split && !ligandKey && !uploaded && split.ligands.length > 0) setLigandKey(split.ligands[0]!.key);
  }, [split, ligandKey, uploaded]);

  /** Starts a new request group. stale() is true once aborted or once the loaded structure (hash) changed. */
  const begin = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedHash = hashRef.current ?? "";
    return { signal: controller.signal, stale: () => controller.signal.aborted || isStaleForStructure(requestedHash, hashRef.current) };
  };
  const beginAux = () => {
    auxRef.current?.abort();
    const controller = new AbortController();
    auxRef.current = controller;
    const requestedHash = hashRef.current ?? "";
    return { signal: controller.signal, stale: () => controller.signal.aborted || isStaleForStructure(requestedHash, hashRef.current) };
  };

  const ligandCandidate = uploaded ? null : split?.ligands.find((l) => l.key === ligandKey) ?? null;
  const boxLigand = split?.ligands.find((l) => l.key === ligandKey) ?? null;
  const inputsReady = Boolean(structure && sourceArtifactId && split && split.receptor.atomCount > 0 && (uploaded || ligandCandidate));
  const ligandIsPdb = uploaded ? uploaded.format === "pdb" : Boolean(ligandCandidate);
  const invalidatePrep = () => { setPrep(null); setAcks([]); };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const format = prepFormatForFile(file.name);
    if (!format) { setError("Upload the ligand as PDB, SDF, MOL or MOL2."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("The ligand file is larger than 20 MB."); return; }
    setError(null);
    setUploaded({ file, name: file.name, format });
    invalidatePrep();
  };

  const planPrep = async () => {
    if (!sourceArtifactId || !inputsReady) return;
    const pHNum = Number(pH);
    if (pH.trim() === "" || !Number.isFinite(pHNum) || pHNum < 0 || pHNum > 14) { setError("pH must be a number between 0 and 14."); return; }
    const smiles = templateSmiles.trim();
    if (smiles.length > SMILES_MAX || /\s/.test(smiles)) { setError(`The SMILES template must be one line without spaces, at most ${SMILES_MAX} characters.`); return; }
    const { signal, stale } = begin();
    setError(null); invalidatePrep();
    try {
      setPrepBusy("Sending the receptor…");
      const receptorArtifactId = await client.importReceptor(sourceArtifactId, signal);
      if (stale()) return;
      setPrepBusy("Sending the ligand…");
      const ligandArtifactId = uploaded
        ? await client.uploadPrepArtifact(uploaded.file, uploaded.format, signal)
        : await client.uploadPrepArtifact(ligandPdbFromAtoms(ligandCandidate?.atoms ?? []), "pdb", signal);
      if (stale()) return;
      const ligandTemplateArtifactId = smiles ? await client.uploadPrepArtifact(`${smiles}\n`, "smi", signal) : undefined;
      if (stale()) return;
      setPrepBusy("Planning the preparation…");
      const state = await client.planPrep({ receptorArtifactId, ligandArtifactId, pH: pHNum, protonation, keepWaters, ligandProtonation: "EXPLICIT_SUBMITTED", addMissingAtoms: false, ...(ligandTemplateArtifactId ? { ligandTemplateArtifactId } : {}) }, signal);
      if (!stale()) setPrep(state);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "Preparation planning failed."));
    } finally {
      if (!stale()) setPrepBusy(null);
    }
  };

  const needAcks = prep?.plan?.decisions.filter((d) => d.requiresAck).map((d) => d.key) ?? [];
  const acksComplete = needAcks.every((k) => acks.includes(k));
  const blockReason = prepBlockReason(prep);
  const planReady = Boolean(prep?.plan && (prep.plan.status === undefined || prep.plan.status === "READY"));

  const confirmPrep = async () => {
    const plan = prep?.plan;
    if (!prep || !plan || !planReady) return;
    const { signal, stale } = begin();
    setPrepBusy("Applying the preparation…"); setError(null);
    try {
      let state = await client.confirmPrep({ jobId: prep.jobId, planDigest: plan.planDigest, acks: needAcks.filter((k) => acks.includes(k)) }, signal);
      if (stale()) return;
      setPrep(state);
      while (state.state === "APPLYING" || state.state === "AWAITING_CONFIRMATION") {
        await sleep(POLL_MS, signal);
        state = await client.getPrep(prep.jobId, signal);
        if (stale()) return;
        if (state.jobId !== prep.jobId) throw new Error("The service answered for another preparation job; it was discarded.");
        setPrep(state);
      }
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "Preparation failed."));
    } finally {
      if (!stale()) setPrepBusy(null);
    }
  };

  const prepared = preparedIds(prep);

  const useLigandBox = () => {
    const box = boxAroundAtoms(boxLigand?.atoms ?? []);
    if (!box) { setError("No ligand atoms in this structure to center the box on. Enter the box by hand."); return; }
    setError(null);
    onReplaceDraft({ centerX: String(box.center[0]), centerY: String(box.center[1]), centerZ: String(box.center[2]), sizeX: String(box.size[0]), sizeY: String(box.size[1]), sizeZ: String(box.size[2]) });
  };

  const numericBox = numericSearchRegionDraft(draft);
  const boxMessage = numericBox ? boxProblem(numericBox.center, numericBox.size) : "Box values must be finite and greater than zero.";

  const runAvailable = caps?.mode === "mock" || (caps?.mode === "real" && caps.vina.available);
  const runUnavailableMessage = capsError ?? (caps === null ? "Checking the docking capability…" : caps.mode === "real" && !caps.vina.available ? `VINA_COMPARATOR_PREVIEW is UNAVAILABLE. ${caps.vina.unavailableReason ?? ""} ${ENABLE_HINT}`.trim() : null);

  const loadPoses = async (res: WizardResult, signal: AbortSignal, stale: () => boolean) => {
    setPosesLoading(true);
    let texts: Readonly<Record<number, string>> = {};
    try {
      texts = await client.getPoseTexts(res, signal);
      if (stale()) return;
      if (Object.keys(texts).length < res.poses.length) setPoseError(`The pose file holds ${Object.keys(texts).length} of ${res.poses.length} poses; missing ones cannot be overlaid.`);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setPoseError(`Pose coordinates are not available, so RMSD and the overlay cannot be shown: ${errText(e, "download failed")}`);
      if (stale()) return;
    } finally {
      if (!stale()) setPosesLoading(false);
    }
    const atomsByRank: Record<number, readonly PoseAtom[]> = {};
    for (const p of res.poses) if (texts[p.rank]) atomsByRank[p.rank] = parsePoseAtoms(texts[p.rank]!, "pdbqt");
    const best = res.poses.slice().sort((a, b) => a.rank - b.rank)[0];
    const bestAtoms = best ? atomsByRank[best.rank] : undefined;
    const out: Record<number, number | null> = {};
    for (const p of res.poses) out[p.rank] = bestAtoms && atomsByRank[p.rank] ? rmsd(bestAtoms, atomsByRank[p.rank]!) : null;
    setPoseTexts(texts);
    setRmsdByRank(out);
  };

  const run = async () => {
    if (!prepared || !numericBox || boxMessage || !runAvailable) return;
    const ex = Number(exhaustiveness), np = Number(numPoses), sd = Number(seed);
    if (!Number.isInteger(ex) || ex < 1 || ex > 64) { setError("Exhaustiveness must be a whole number from 1 to 64."); return; }
    if (!Number.isInteger(np) || np < 1 || np > 20) { setError("Number of poses must be a whole number from 1 to 20."); return; }
    if (!Number.isInteger(sd) || sd < 1 || sd > 2_147_483_647) { setError("Seed must be a whole number from 1 to 2147483647."); return; }
    const { signal, stale } = begin();
    auxRef.current?.abort();
    jobIdRef.current = null;
    setRunBusy(true); setError(null); setPoseError(null); setResult(null); setJob(null); setWatchMode(null); setSelectedRank(null); setPoseTexts({}); setRmsdByRank({}); onPoseOverlay(null);
    try {
      const started = await client.startJob({ receptorPreparedId: prepared.receptor, ligandPreparedId: prepared.ligand, boxCenter: [...numericBox.center], boxSize: [...numericBox.size], exhaustiveness: ex, numPoses: np, seed: sd }, signal);
      if (stale()) return;
      const jobId = started.job.jobId;
      jobIdRef.current = jobId;
      setJob(started.job);
      const final = await client.watchJob(jobId, {
        signal,
        onJob: (j) => { if (!stale() && j.jobId === jobIdRef.current) setJob(j); },
        onMode: (mode, reason) => { if (!stale()) setWatchMode({ mode, ...(reason ? { reason } : {}) }); },
      });
      if (stale() || final.jobId !== jobIdRef.current) return;
      setJob(final);
      if (final.status === "FAILED") { setError(final.error ?? "The docking job failed without a message."); return; }
      if (final.status !== "COMPLETED") return;
      const res = await client.getResult(jobId, signal);
      if (stale() || res.jobId !== jobIdRef.current) return;
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
    // The watcher keeps running and observes the CANCELLED state from the server; the cancel call has its own signal.
    const { signal, stale } = beginAux();
    setCancelBusy(true);
    try {
      const status = await client.cancelJob(id, signal);
      if (!stale() && status.jobId === jobIdRef.current) setJob(status);
    } catch (e) {
      if (!isAbortError(e) && !stale()) setError(errText(e, "Cancel failed."));
    } finally {
      if (!stale()) setCancelBusy(false);
    }
  };

  const overlayFor = (rank: number, withHbonds: boolean): PoseOverlay | null => {
    const text = poseTexts[rank];
    if (!text || !structureHash) return null;
    const atoms = parsePoseAtoms(text, "pdbqt");
    if (atoms.length === 0) return null;
    return { rank, format: "pdbqt", text, hbonds: withHbonds && structure ? hbondLines(atoms, structure.structure.atoms) : [], structureHash };
  };
  const selectPose = (rank: number) => {
    setSelectedRank(rank);
    setPoseError(null);
    const overlay = overlayFor(rank, showHbonds);
    onPoseOverlay(overlay);
    if (!overlay) setPoseError(posesLoading ? "Pose coordinates are still loading." : "No coordinates are available for this pose, so it cannot be overlaid.");
  };
  const toggleHbonds = (on: boolean) => {
    setShowHbonds(on);
    if (selectedRank !== null) onPoseOverlay(overlayFor(selectedRank, on));
  };

  const save = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const download = async (name: DownloadName) => {
    if (!result) return;
    const { signal, stale } = beginAux();
    setPoseError(null);
    try {
      const text = await client.download(result, name, signal);
      if (!stale()) save(`docking-${result.jobId.slice(0, 8)}-${name}`, text, name.endsWith(".json") ? "application/json" : "chemical/x-pdbqt");
    } catch (e) {
      if (!isAbortError(e) && !stale()) setPoseError(`Download failed: ${errText(e, "unavailable")}`);
    }
  };

  const mock = client.isMock || caps?.mode === "mock" || Boolean(result?.mock);
  const reached = (s: WizardStep): boolean => s === "Inputs" || (s === "Prepare" && inputsReady) || (s === "Box" && Boolean(prepared)) || (s === "Run" && Boolean(prepared) && !boxMessage) || (s === "Results" && Boolean(result));
  const sortedPoses = result ? result.poses.slice().sort((a, b) => a.rank - b.rank) : [];
  const plan = prep?.plan;
  const inSiteHis = plan?.histidines?.filter((h) => h.inSite) ?? [];
  const hisCounts = (plan?.histidines ?? []).reduce<Record<string, number>>((acc, h) => { acc[h.state] = (acc[h.state] ?? 0) + 1; return acc; }, {});
  const jobActive = Boolean(job && !isTerminal(job.status));

  return (
    <section className="docking-card docking-wizard" aria-label="Docking wizard" data-testid="docking-wizard">
      <div className="docking-preview-banner" role="note" data-testid="docking-preview-banner"><strong>Preview: not scientifically qualified.</strong> Scores are for exploration and must not be used as evidence.{mock && <span className="docking-mock-label" data-testid="docking-mock-label"> MOCK SERVER: all numbers are fake test data, not docking results.</span>}</div>
      {caps?.mode === "real" && caps.vina.available && <div className="docking-preview-banner" role="note" data-testid="vina-experimental-banner"><strong>{VINA_EXPERIMENTAL_BANNER}</strong></div>}
      {caps?.mode === "real" && <div className="docking-state-list" data-testid="docking-capabilities" aria-label="Docking capabilities">
        <div className="docking-state-row" data-testid="capability-vina"><span>VINA_COMPARATOR_PREVIEW ({caps.vina.engine.name} {caps.vina.engine.version})</span><strong>{caps.vina.capability} · {caps.vina.implementation} · {caps.vina.validation}</strong></div>
        <div className="docking-state-row" data-testid="capability-docking-run" title={caps.dockingRun.reason}><span>DOCKING.RUN (Mole engine)</span><strong>{caps.dockingRun.state}</strong></div>
      </div>}
      <ol className="docking-wizard-steps" aria-label="Docking steps">
        {WIZARD_STEPS.map((s, i) => <li key={s}><button type="button" aria-current={s === step ? "step" : undefined} data-testid={`wizard-step-${s.toLowerCase()}`} disabled={!reached(s)} onClick={() => { setError(null); setStep(s); }}>{i + 1}. {s}</button></li>)}
      </ol>
      <Err message={error} />

      {step === "Inputs" && <div data-testid="wizard-inputs">
        {!structure || !split ? <p className="docking-help">Import a structure first.{onImport && <> <button type="button" onClick={onImport}>Import structure</button></>}</p> : <>
          <div className="docking-state-row" data-testid="wizard-receptor"><span>Receptor (polymer)</span><strong>{split.receptor.atomCount > 0 ? `${split.receptor.atomCount.toLocaleString("en-US")} atoms · chains ${split.receptor.chains.join(", ")}` : "No polymer atoms found"}</strong></div>
          <label className="docking-field"><span>Ligand</span>
            <select aria-label="Ligand" value={uploaded ? "__upload" : ligandKey} onChange={(e) => { if (e.target.value !== "__upload") { setUploaded(null); setLigandKey(e.target.value); invalidatePrep(); } }}>
              {split.ligands.map((l) => <option key={l.key} value={l.key}>{l.label} · {l.atomCount} atoms (from structure)</option>)}
              {uploaded && <option value="__upload">{uploaded.name} (uploaded)</option>}
              {split.ligands.length === 0 && !uploaded && <option value="">No ligand in structure; upload one</option>}
            </select></label>
          <label className="docking-field"><span>Or upload a separate ligand file (SDF, MOL, MOL2, PDB)</span><input type="file" aria-label="Upload ligand file" accept=".sdf,.mol,.mol2,.pdb" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <label className="docking-field"><span>Ligand SMILES template (isomeric; gives bond orders and stereo)</span><input aria-label="Ligand SMILES template" type="text" spellCheck={false} maxLength={SMILES_MAX} value={templateSmiles} onChange={(e) => { setTemplateSmiles(e.target.value); invalidatePrep(); }} /></label>
          {ligandIsPdb && !templateSmiles.trim() && <p className="docking-help" data-testid="smiles-hint">A PDB ligand has no bond orders. Without an isomeric SMILES template the preparation is BLOCKED.</p>}
          {!sourceArtifactId && <p className="docking-help" role="status">Waiting for the source artifact id from the D2 adapter.</p>}
          <div className="docking-region-actions"><button className="docking-primary-action" type="button" disabled={!inputsReady} onClick={() => setStep("Prepare")}>Next: Prepare</button></div>
        </>}
      </div>}

      {step === "Prepare" && <div data-testid="wizard-prepare">
        <div className="docking-region-grid">
          <label><span>pH</span><input aria-label="pH" type="number" step="0.1" min="0" max="14" value={pH} onChange={(e) => { setPH(e.target.value); invalidatePrep(); }} /></label>
          <label><span>Protonation</span><select aria-label="Protonation" value={protonation} onChange={(e) => { setProtonation(e.target.value as typeof protonation); invalidatePrep(); }}><option value="EXPLICIT_SUBMITTED">Use submitted hydrogens</option><option value="PROPKA_PREVIEW">PROPKA estimate (preview)</option></select></label>
          <label><span>Keep waters</span><input aria-label="Keep waters" type="checkbox" checked={keepWaters} onChange={(e) => { setKeepWaters(e.target.checked); invalidatePrep(); }} /></label>
        </div>
        <div className="docking-region-actions"><button type="button" disabled={Boolean(prepBusy) || !inputsReady} onClick={() => void planPrep()}>{prepBusy && !prep ? "Planning…" : "Prepare"}</button></div>
        {prepBusy && <p role="status" data-testid="prep-busy">{prepBusy}</p>}
        {prep && <div className="docking-card" data-testid="prep-report">
          <h3>Preparation report</h3>
          <div className="docking-state-row"><span>State</span><strong data-testid="prep-state">{prep.state}</strong></div>
          {plan && <>
            <div className="docking-state-row"><span>Plan status</span><strong data-testid="prep-plan-status">{plan.status ?? "READY"}{plan.qualification ? ` · ${plan.qualification}` : ""}</strong></div>
            <div className="docking-state-row"><span>pH / protonation</span><strong>{plan.pH} · {plan.protonationSource}</strong></div>
            <div className="docking-state-row"><span>Charge model / tautomer</span><strong>{plan.chargeModel} · {plan.tautomer}</strong></div>
            <div className="docking-state-row"><span>Rotatable bonds</span><strong>{plan.rotatableBonds}</strong></div>
            {plan.ligandStereo && <div className="docking-state-row" data-testid="prep-stereo"><span>Ligand stereo</span><strong>{plan.ligandStereo.source} · {plan.ligandStereo.elements.length === 0 ? "no stereo elements" : plan.ligandStereo.elements.slice(0, 12).map((s) => `${s.atoms.join("-")} ${s.label}`).join(", ")}</strong></div>}
            {plan.histidines && <div className="docking-state-row" data-testid="prep-histidines"><span>Histidines</span><strong>{plan.histidines.length === 0 ? "none" : Object.entries(hisCounts).map(([k, v]) => `${v} ${k}`).join(", ")}{inSiteHis.length > 0 ? ` · in site: ${inSiteHis.slice(0, 8).map((h) => `${h.chain}${h.resSeq}${h.iCode} ${h.state} (${h.source})`).join(", ")}` : ""}</strong></div>}
            {plan.siteHetero && <div className="docking-state-row" data-testid="prep-site-hetero"><span>Hetero groups near the site</span><strong>{plan.siteHetero.filter((g) => g.inSite).length === 0 ? "none in site" : plan.siteHetero.filter((g) => g.inSite).slice(0, 10).map((g) => `${g.group} ${g.class}${g.distance === null ? "" : ` ${g.distance.toFixed(1)} Å`}`).join(", ")}</strong></div>}
            <ul>{plan.decisions.map((d) => <li key={d.key}><strong>{d.key}</strong>: {d.choice} ({d.atomsBefore} to {d.atomsAfter} atoms){d.requiresAck && <label> <input type="checkbox" aria-label={`Acknowledge ${d.key}`} checked={acks.includes(d.key)} disabled={prep.state !== "AWAITING_CONFIRMATION"} onChange={(e) => setAcks((cur) => e.target.checked ? [...cur, d.key] : cur.filter((k) => k !== d.key))} /> I accept this</label>}</li>)}</ul>
            {plan.warnings.map((w) => <div className="docking-diagnostic docking-diagnostic--warning" key={w}>{w}</div>)}
          </>}
          {prep.seal && <div className="docking-state-row" data-testid="prep-seal"><span>Seal</span><strong>{prep.seal.status} · {prep.seal.qualification}{prep.seal.reasonCodes.length ? ` · ${prep.seal.reasonCodes.slice(0, 6).join(", ")}` : ""}</strong></div>}
          {prepared && !prep.preparedReceptorId && <p className="docking-help" data-testid="prep-preview-note">Dockable only as PREVIEW_UNQUALIFIED: some chemistry was generated, not submitted.</p>}
          <Err message={blockReason} testId="prep-blocked" />
          {needAcks.length > 0 && !acksComplete && prep.state === "AWAITING_CONFIRMATION" && <p className="docking-help">Acknowledge each marked decision to confirm.</p>}
          <div className="docking-region-actions">
            <button className="docking-primary-action" type="button" data-testid="prep-confirm" disabled={Boolean(prepBusy) || prep.state !== "AWAITING_CONFIRMATION" || !planReady || !acksComplete} onClick={() => void confirmPrep()}>{prepBusy && prep ? "Working…" : "Confirm"}</button>
            <button type="button" disabled={!prepared} onClick={() => setStep("Box")}>Next: Box</button>
          </div>
        </div>}
      </div>}

      {step === "Box" && <div data-testid="wizard-box">
        <SearchRegionEditor draft={draft} coordinateFrame={coordinateFrame} committedRegion={committedRegion} commitMessage={commitMessage} commitBusy={commitBusy} onDraftChange={onDraftChange} onShowDraft={onShowDraft} onCommit={onCommit} />
        <div className="docking-region-actions"><button type="button" disabled={!boxLigand} title={boxLigand ? undefined : "Needs a ligand that is part of the loaded structure"} onClick={useLigandBox}>Box around ligand</button><button className="docking-primary-action" type="button" disabled={Boolean(boxMessage)} onClick={() => setStep("Run")}>Next: Run</button></div>
        <Err message={boxMessage} />
      </div>}

      {step === "Run" && <div data-testid="wizard-run">
        {runUnavailableMessage && <div className="docking-inline-diagnostic" role="status" data-testid="run-unavailable">{runUnavailableMessage}</div>}
        <div className="docking-region-grid">
          <label><span>Exhaustiveness (1-64)</span><input aria-label="Exhaustiveness" type="number" min="1" max="64" value={exhaustiveness} disabled={runBusy} onChange={(e) => setExhaustiveness(e.target.value)} /></label>
          <label><span>Poses (1-20)</span><input aria-label="Number of poses" type="number" min="1" max="20" value={numPoses} disabled={runBusy} onChange={(e) => setNumPoses(e.target.value)} /></label>
          <label><span>Seed</span><input aria-label="Seed" type="number" min="1" value={seed} disabled={runBusy} onChange={(e) => setSeed(e.target.value)} /></label>
        </div>
        <div className="docking-region-actions">
          <button className="docking-primary-action" type="button" data-testid="run-start" disabled={runBusy || !prepared || Boolean(boxMessage) || !runAvailable || Boolean(blockReason)} onClick={() => void run()}>{runBusy ? "Running…" : "Run docking"}</button>
          <button type="button" data-testid="run-cancel" disabled={!jobActive || cancelBusy} onClick={() => void cancel()}>{cancelBusy ? "Cancelling…" : "Cancel"}</button>
        </div>
        {runBusy && !job && <p role="status">Submitting the job…</p>}
        {job && <div data-testid="run-status"><progress aria-label="Docking progress" max={1} value={job.progress} /> <span data-testid="run-status-text">{job.status}{job.stage && !isTerminal(job.status) ? ` · ${job.stage}` : ""} · {Math.round(job.progress * 100)}%{job.message ? ` · ${job.message}` : ""}</span></div>}
        {watchMode?.mode === "polling" && jobActive && <p className="docking-help" data-testid="run-polling">Live updates are unavailable ({watchMode.reason ?? "stream failed"}); checking the job state every second instead.</p>}
        {job?.status === "CANCELLED" && <p role="status" data-testid="run-cancelled">Job cancelled. No results were produced.</p>}
        {job?.status === "COMPLETED" && !result && runBusy && <p role="status">Docking completed; loading the result…</p>}
        <Err message={boxMessage} />
      </div>}

      {step === "Results" && result && <div data-testid="wizard-results">
        <p className="docking-help" data-testid="results-label">Label: <strong>{result.label}</strong>. Docking completed; completion is not validation. {DOCK_SCORE_LABEL.scoreName}: {result.engine ?? DOCK_SCORE_LABEL.scoringProfile}, {DOCK_SCORE_LABEL.scoreDirection}; {DOCK_SCORE_LABEL.unitsNote}.</p>
        <p className="docking-help" data-testid="results-me-score">ME score: unavailable ({result.meScoreReason}).</p>
        {(result.seed !== null || result.prepQualification) && <p className="docking-help" data-testid="results-provenance">{result.seed !== null ? `Seed ${result.seed}. ` : ""}{result.prepQualification ? `Preparation ${result.prepQualification}${result.prepSealStatus ? ` (seal ${result.prepSealStatus})` : ""}.` : ""}</p>}
        <table className="docking-results-table" data-testid="results-table">
          <thead><tr><th>Rank</th><th title="not a binding free energy">Vina score (empirical, lower is better)</th><th>ME score</th><th title="reported by Vina">RMSD l.b. / u.b. from rank 1</th><th title="heavy atoms, file order, no symmetry">RMSD to rank 1</th></tr></thead>
          <tbody>{sortedPoses.map((p) => <tr key={p.rank} aria-selected={p.rank === selectedRank} data-testid={`pose-row-${p.rank}`} onClick={() => selectPose(p.rank)} style={{ cursor: "pointer", fontWeight: p.rank === selectedRank ? 700 : 400 }}><td>{p.rank === 1 ? "1 (top-ranked)" : p.rank}</td><td>{formatScore(p.vinaScore)}</td><td>unavailable</td><td>{p.rmsdLbFromBest === null ? "n/a" : `${p.rmsdLbFromBest.toFixed(2)} / ${p.rmsdUbFromBest === null ? "n/a" : p.rmsdUbFromBest.toFixed(2)}`}</td><td>{rmsdByRank[p.rank] == null ? "n/a" : rmsdByRank[p.rank]!.toFixed(2)}</td></tr>)}</tbody>
        </table>
        {sortedPoses.length === 0 && <p role="status">The job finished but returned no poses.</p>}
        {posesLoading && <p role="status">Loading pose coordinates…</p>}
        <label><input type="checkbox" aria-label="Show H-bond lines" checked={showHbonds} onChange={(e) => toggleHbonds(e.target.checked)} /> Show H-bond lines (N/O pairs within 3.5 Å, distance only)</label>
        <div className="docking-region-actions" data-testid="results-downloads">
          {result.downloads.map((name) => <button type="button" key={name} data-testid={`download-${name}`} onClick={() => void download(name)}>Download {name}</button>)}
        </div>
        <Err message={poseError} />
      </div>}
    </section>
  );
};
