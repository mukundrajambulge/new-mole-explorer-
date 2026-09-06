import { useMemo, useState } from "react";
import type { WorkspaceObject } from "../workspace/workspaceModel";
import type { FittingAnalysis } from "../analysis/pymolFitting";
import type { ConsoleCommandResult } from "./ConsolePanel";

type AlignmentPanelProps = {
  objects: readonly WorkspaceObject[];
  results: readonly (FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" })[];
  onCommand: (command: string) => ConsoleCommandResult;
};

export const AlignmentPanel = ({ objects, results, onCommand }: AlignmentPanelProps) => {
  const [mobileObjectId, setMobileObjectId] = useState(objects[0]?.objectId ?? "");
  const [targetObjectId, setTargetObjectId] = useState(objects[1]?.objectId ?? objects[0]?.objectId ?? "");
  const [mobileSelection, setMobileSelection] = useState("all");
  const [targetSelection, setTargetSelection] = useState("all");
  const [method, setMethod] = useState("rms_cur");
  const [mapping, setMapping] = useState("SOURCE_IDENTITY_STRICT");
  const [transform, setTransform] = useState("ANALYZE_ONLY");
  const [refinementCycles, setRefinementCycles] = useState("0");
  const [createObject, setCreateObject] = useState(true);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const activeScope = useMemo(() => objects.length > 1 ? (id: string) => "object " + id + " and" : () => "", [objects.length]);

  const run = () => {
    const mobile = (activeScope(mobileObjectId) + " (" + mobileSelection + ")").trim();
    const target = (activeScope(targetObjectId) + " (" + targetSelection + ")").trim();
    const command = method + " " + mobile + ", " + target;
    const result = onCommand(command);
    setLastStatus(command + " · " + result.status + (refinementCycles !== "0" ? " · refinement cycles " + refinementCycles : "") + " · " + mapping + (createObject ? " · alignment object requested" : "") + (transform === "ANALYZE_ONLY" ? " · ANALYZE ONLY" : " · FIT & APPLY"));
  };

  return <section className="panel-card alignment-workflow" data-testid="alignment-workflow">
    <div className="panel-heading"><div><span className="eyebrow">R08 STRUCTURAL ANALYSIS</span><h2>Align</h2></div><span className="capability-tag">ORACLE PENDING</span></div>
    <div className="alignment-form-grid">
      <label><span>MOBILE</span><select value={mobileObjectId} onChange={(event) => setMobileObjectId(event.target.value)}>{objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.displayName}</option>)}</select><input aria-label="Mobile selection" value={mobileSelection} onChange={(event) => setMobileSelection(event.target.value)} /></label>
      <label><span>TARGET</span><select value={targetObjectId} onChange={(event) => setTargetObjectId(event.target.value)}>{objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.displayName}</option>)}</select><input aria-label="Target selection" value={targetSelection} onChange={(event) => setTargetSelection(event.target.value)} /></label>
      <label><span>METHOD</span><select value={method} onChange={(event) => setMethod(event.target.value)}>{["rms_cur", "rms", "fit", "pair_fit", "align", "super", "cealign"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>MAPPING MODE</span><select value={mapping} onChange={(event) => setMapping(event.target.value)}>{["SOURCE_IDENTITY_STRICT", "EXPLICIT", "SEQUENCE_GUIDED", "STRUCTURE_GUIDED"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>TRANSFORM</span><select value={transform} onChange={(event) => setTransform(event.target.value)}><option value="ANALYZE_ONLY">ANALYZE ONLY</option><option value="FIT_AND_APPLY">FIT &amp; APPLY</option></select></label>
      <label><span>REFINEMENT CYCLES</span><input inputMode="numeric" value={refinementCycles} onChange={(event) => setRefinementCycles(event.target.value.replace(/[^0-9]/g, ""))} /></label>
    </div>
    <label className="alignment-checkbox"><input type="checkbox" checked={createObject} onChange={(event) => setCreateObject(event.target.checked)} /> Create alignment object</label>
    <button type="button" className="measurement-clear-all" data-testid="alignment-execute" onClick={run} disabled={!objects.length}>Execute governed alignment</button>
    {lastStatus && <div className="measurement-hint" role="status">{lastStatus}</div>}
    {results.length > 0 && <div className="alignment-result-summary">{results.slice(0, 3).map((entry) => <div key={entry.result.resultId}><strong>{entry.result.operationKind} · {entry.applyStatus}</strong><span>{entry.result.resultDisposition} · {entry.result.currentRmsd?.toFixed(4) ?? "—"} → {entry.result.evaluationRmsd?.toFixed(4) ?? "—"} Å</span></div>)}</div>}
  </section>;
};
