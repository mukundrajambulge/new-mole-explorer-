import { useEffect, useMemo, useState } from "react";
import type { WorkspaceObject } from "../workspace/workspaceModel";
import type { FittingAnalysis } from "../analysis/pymolFitting";
import type { AlignmentWorkflowOptions, MappingMode } from "../analysis/alignment";
import type { ConsoleCommandResult } from "./ConsolePanel";

type AlignmentPanelProps = {
  objects: readonly WorkspaceObject[];
  results: readonly (FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" })[];
  onCommand: (command: string, options?: AlignmentWorkflowOptions) => ConsoleCommandResult;
  canUndo?: boolean;
  canRedo?: boolean;
};

export const AlignmentPanel = ({ objects, results, onCommand, canUndo = false, canRedo = false }: AlignmentPanelProps) => {
  const [mobileObjectId, setMobileObjectId] = useState(objects[0]?.objectId ?? "");
  const [targetObjectId, setTargetObjectId] = useState(objects[1]?.objectId ?? objects[0]?.objectId ?? "");
  const [mobileSelection, setMobileSelection] = useState("all");
  const [targetSelection, setTargetSelection] = useState("all");
  const [mobileStateId, setMobileStateId] = useState(objects[0]?.currentStateId ?? "");
  const [targetStateId, setTargetStateId] = useState(objects[1]?.currentStateId ?? objects[0]?.currentStateId ?? "");
  const [method, setMethod] = useState("rms_cur");
  const [mapping, setMapping] = useState("SOURCE_IDENTITY_STRICT");
  const [transform, setTransform] = useState("ANALYZE_ONLY");
  const [refinementCycles, setRefinementCycles] = useState("0");
  const [createObject, setCreateObject] = useState(true);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  useEffect(() => {
    setMobileObjectId((current) => objects.some((object) => object.objectId === current) ? current : objects[0]?.objectId ?? "");
    setTargetObjectId((current) => objects.some((object) => object.objectId === current) ? current : objects[1]?.objectId ?? objects[0]?.objectId ?? "");
  }, [objects]);
  useEffect(() => {
    const object = objects.find((candidate) => candidate.objectId === mobileObjectId);
    setMobileStateId((current) => object?.stateOrder.includes(current) ? current : object?.currentStateId ?? "");
  }, [objects, mobileObjectId]);
  useEffect(() => {
    const object = objects.find((candidate) => candidate.objectId === targetObjectId);
    setTargetStateId((current) => object?.stateOrder.includes(current) ? current : object?.currentStateId ?? "");
  }, [objects, targetObjectId]);
  const activeScope = useMemo(() => objects.length > 1 ? (id: string) => "object " + id + " and" : () => "", [objects.length]);

  const run = () => {
    const mobile = (activeScope(mobileObjectId) + " (" + mobileSelection + ")").trim();
    const target = (activeScope(targetObjectId) + " (" + targetSelection + ")").trim();
    const options: AlignmentWorkflowOptions = { mappingMode: mapping as MappingMode, sourceStateId: mobileStateId, targetStateId, refinementCycles: Math.max(0, Number.parseInt(refinementCycles || "0", 10) || 0), transformMode: transform as AlignmentWorkflowOptions["transformMode"], alignmentObjectRequested: createObject };
    const command = method + " " + mobile + ", " + target;
    const result = onCommand(command, options);
    setLastStatus(command + " · " + result.status + (refinementCycles !== "0" ? " · refinement cycles " + refinementCycles : "") + " · " + mapping + (createObject ? " · alignment object requested" : "") + (transform === "ANALYZE_ONLY" ? " · ANALYZE ONLY" : " · FIT & APPLY"));
  };

  return <section className="panel-card alignment-workflow" data-testid="alignment-workflow">
    <div className="panel-heading"><div><span className="eyebrow">R08 STRUCTURAL ANALYSIS</span><h2>Align</h2></div><span className="capability-tag">ORACLE PENDING</span></div>
    <div className="alignment-form-grid">
      <label><span>MOBILE</span><select value={mobileObjectId} onChange={(event) => { const next = objects.find((object) => object.objectId === event.target.value); setMobileObjectId(event.target.value); setMobileStateId(next?.currentStateId ?? ""); }}>{objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.displayName}</option>)}</select><input aria-label="Mobile selection" value={mobileSelection} onChange={(event) => setMobileSelection(event.target.value)} /><select aria-label="Mobile state" value={mobileStateId} onChange={(event) => setMobileStateId(event.target.value)}>{(objects.find((object) => object.objectId === mobileObjectId)?.stateOrder ?? []).map((stateId) => <option key={stateId} value={stateId}>{stateId}</option>)}</select></label>
      <label><span>TARGET</span><select value={targetObjectId} onChange={(event) => { const next = objects.find((object) => object.objectId === event.target.value); setTargetObjectId(event.target.value); setTargetStateId(next?.currentStateId ?? ""); }}>{objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.displayName}</option>)}</select><input aria-label="Target selection" value={targetSelection} onChange={(event) => setTargetSelection(event.target.value)} /><select aria-label="Target state" value={targetStateId} onChange={(event) => setTargetStateId(event.target.value)}>{(objects.find((object) => object.objectId === targetObjectId)?.stateOrder ?? []).map((stateId) => <option key={stateId} value={stateId}>{stateId}</option>)}</select></label>
      <label><span>METHOD</span><select value={method} onChange={(event) => { const next = event.target.value; setMethod(next); if (next === "align" || next === "super") setMapping("SEQUENCE_GUIDED"); else if (mapping === "SEQUENCE_GUIDED") setMapping("SOURCE_IDENTITY_STRICT"); }}>{["rms_cur", "rms", "fit", "pair_fit", "align", "super", "cealign"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>MAPPING MODE</span><select value={mapping} onChange={(event) => setMapping(event.target.value)}>{["SOURCE_IDENTITY_STRICT", "EXPLICIT", "SEQUENCE_GUIDED", "SYMMETRY_AWARE_LIGAND", "STRUCTURE_GUIDED", "INDEX_ORDER"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>TRANSFORM</span><select value={transform} onChange={(event) => setTransform(event.target.value)}><option value="ANALYZE_ONLY">ANALYZE ONLY</option><option value="FIT_AND_APPLY">FIT &amp; APPLY</option></select></label>
      <label><span>REFINEMENT CYCLES</span><input inputMode="numeric" value={refinementCycles} onChange={(event) => setRefinementCycles(event.target.value.replace(/[^0-9]/g, ""))} /></label>
    </div>
    <label className="alignment-checkbox"><input type="checkbox" checked={createObject} onChange={(event) => setCreateObject(event.target.checked)} /> Create alignment object</label>
    <button type="button" className="measurement-clear-all" data-testid="alignment-execute" onClick={run} disabled={!objects.length}>Execute governed alignment</button>
    {lastStatus && <div className="measurement-hint" role="status">{lastStatus}</div>}
    {results.length > 0 && <div className="alignment-result-summary">{results.slice(0, 3).map((entry) => <div key={entry.result.resultId} className="alignment-result-detail"><strong>{entry.result.operationKind} · {entry.applyStatus}</strong><span>{entry.result.resultDisposition} · current {entry.result.currentRmsd?.toFixed(4) ?? "—"} Å · initial fit {entry.result.initialFittedRmsd?.toFixed(4) ?? "—"} Å · refined {entry.result.refinedCoreRmsd?.toFixed(4) ?? "—"} Å · evaluation {entry.result.evaluationRmsd?.toFixed(4) ?? "—"}</span><span>{entry.result.retainedPairCount}/{entry.result.initialPairCount} retained · {entry.result.rejectedPairIds.length} rejected · coverage {Math.round(entry.result.coverage.paired * 100)}% · {entry.result.sourceCoordinateContext.stateId} → {entry.result.targetCoordinateContext.stateId}</span><span>aligned residues {entry.result.alignedResidueCount} · sequence score {entry.result.sequenceAlignmentScore?.toFixed(2) ?? "—"} · mapping {entry.result.mappingMode}</span><span>cycles {Math.max(0, entry.result.refinementHistory.length - 1)} · det {entry.result.determinant?.toFixed(6) ?? "—"} · condition {entry.result.conditioning?.toExponential(2) ?? "—"} · {entry.result.transformUniqueness}</span><span>warnings {entry.result.warnings.length ? entry.result.warnings.join(" | ") : "none"} · undo {canUndo ? "available" : "not available"} · redo {canRedo ? "available" : "not available"}</span>{entry.alignmentObject && <div className="alignment-pair-links" aria-label="Alignment pair presentation">{entry.alignmentObject.links.slice(0, 8).map((link) => <span key={link.pairId} data-retained={link.retained ? "true" : "false"}>{link.sourceAtomUid} ↔ {link.targetAtomUid} · {link.residual?.toFixed(3) ?? "—"} Å</span>)}</div>}</div>)}</div>}
  </section>;
};
