import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import type { SearchRegionOverlay } from "../rendering/searchRegionOverlay";
import type { D2SearchRegionAuthority, DockingApiAdapter, D2AdaptationResult } from "./dockingApiAdapter";
import { dockingApiAdapter } from "./dockingApiAdapter";
import { DockingBottomPanel } from "./DockingBottomPanel";
import { DockingInputsPanel } from "./DockingInputsPanel";
import { DockingWorkflowPanel } from "./DockingWorkflowPanel";
import { draftForStructure, emptyDockingAdaptation, emptySearchRegionDraft, numericSearchRegionDraft, overlayForCommitted, overlayForDraft, type DockingAdaptationState, type SearchRegionDraft } from "./dockingUiState";

type DockingPreparationInput = Readonly<{ preparedReceptor: unknown; preparedLigand: unknown; coordinateFrame: string; bindingSiteRef: string; fixedAcrossLigandStates?: boolean }>;

export type DockingWorkspaceProps = {
  structure: StructureLoadResult | null;
  onImport: () => void;
  onOpenMolecular: () => void;
  renderViewer: (overlay: SearchRegionOverlay | null) => ReactNode;
  apiAdapter?: DockingApiAdapter;
  preparationInput?: DockingPreparationInput;
};

const adaptationMessage = (result: D2AdaptationResult): string | null => result.diagnostics.find((diagnostic) => diagnostic.blocking)?.message ?? result.diagnostics[0]?.message ?? null;

export const DockingWorkspace = ({ structure, onImport, onOpenMolecular, renderViewer, apiAdapter = dockingApiAdapter, preparationInput }: DockingWorkspaceProps) => {
  const [adaptation, setAdaptation] = useState<DockingAdaptationState>(emptyDockingAdaptation);
  const [draft, setDraft] = useState<SearchRegionDraft>(emptySearchRegionDraft);
  const [committedRegion, setCommittedRegion] = useState<D2SearchRegionAuthority | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const coordinateFrame = adaptation.snapshot?.coordinateStates[0]?.coordinateFrame ?? "unresolved-D2-coordinate-frame";

  useEffect(() => {
    setDraft(draftForStructure(structure?.structure ?? null));
    setCommittedRegion(null);
    setCommitMessage(null);
    if (!structure) { setAdaptation(emptyDockingAdaptation()); return; }
    let cancelled = false;
    setAdaptation({ phase: "LOADING", snapshot: null, message: null });
    void apiAdapter.adaptStructure(structure).then((result) => {
      if (cancelled) return;
      setAdaptation({ phase: result.snapshot ? "READY" : "BLOCKED", snapshot: result.snapshot ?? null, message: adaptationMessage(result) });
    }).catch((error) => {
      if (cancelled) return;
      setAdaptation({ phase: "TRANSPORT_ERROR", snapshot: null, message: error instanceof Error ? error.message : "D2 adaptation failed." });
    });
    return () => { cancelled = true; };
  }, [apiAdapter, structure]);

  const draftOverlay = useMemo(() => overlayForDraft(draft, coordinateFrame), [coordinateFrame, draft]);
  const overlay = structure ? (committedRegion ? overlayForCommitted(committedRegion) : draftOverlay) : null;

  const updateDraft = (field: keyof SearchRegionDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setCommitMessage(null);
    setCommittedRegion(null);
  };

  const commit = () => {
    const numeric = numericSearchRegionDraft(draft);
    if (!numeric) { setCommitMessage("BLOCKED: center and size values must be finite, and all three dimensions must be greater than zero."); return; }
    if (!preparationInput) { setCommitMessage("BLOCKED: an explicit PreparedReceptorState and PreparedLigandState are required before D2 can seal a SearchRegion. No scientific state changed."); return; }
    const [x, y, z] = numeric.center;
    const [sx, sy, sz] = numeric.size;
    setCommitBusy(true);
    setCommitMessage(null);
    void apiAdapter.commitSearchRegion({ ...preparationInput, coordinateFrame, min: [x - sx / 2, y - sy / 2, z - sz / 2], max: [x + sx / 2, y + sy / 2, z + sz / 2], paddingAngstrom: [0, 0, 0], derivationMode: "EXPLICIT_BOUNDS", fixedAcrossLigandStates: preparationInput.fixedAcrossLigandStates ?? true }).then((result) => {
      const diagnostic = result.diagnostics.find((item) => item.blocking) ?? result.diagnostics[0];
      setCommitBusy(false);
      if (result.region) { setCommittedRegion(result.region); setCommitMessage("Committed authoritative D2 SearchRegion."); }
      else setCommitMessage(`${result.status}: ${diagnostic?.message ?? "D2 did not return an authoritative SearchRegion."}`);
    }).catch((error) => {
      setCommitBusy(false);
      setCommitMessage(error instanceof Error ? error.message : "D2 SearchRegion commit failed; no scientific state changed.");
    });
  };

  const diagnostics = adaptation.snapshot?.validationDiagnostics ?? [];
  return <section className="docking-workspace" aria-label="Docking workspace" data-testid="docking-workspace"><header className="docking-workspace-header"><div><span className="docking-eyebrow">D2 PREPARATION WORKSPACE</span><h1>Docking</h1><p>Explicit receptor, ligand, and SearchRegion state. Execution is not available in this gate.</p></div><div className="docking-header-actions"><span className="docking-gate-badge">UI-D0 · D2</span><button type="button" onClick={onOpenMolecular}>Molecular workspace</button></div></header><div className="docking-workspace-grid"><DockingInputsPanel structure={structure} adaptation={adaptation.snapshot} adaptationPhase={adaptation.phase === "LOADING" ? "D2 adapting…" : adaptation.phase} diagnostics={diagnostics} draft={draft} coordinateFrame={coordinateFrame} committedRegion={committedRegion} commitMessage={commitMessage} commitBusy={commitBusy} onImport={onImport} onDraftChange={updateDraft} onShowDraft={() => setCommitMessage(!structure ? "BLOCKED: load explicit source evidence before projecting a SearchRegion." : draftOverlay ? "Draft SearchRegion projected; it is not scientific authority." : "BLOCKED: draft values are not finite or dimensions are not positive.")} onCommit={commit} /><section className="docking-viewer-column"><div className="docking-viewer-banner"><span>EXISTING MOLECULARCANVAS</span><strong>{committedRegion ? "Committed SearchRegion projection" : structure && draftOverlay ? "Draft SearchRegion projection" : "No SearchRegion projection"}</strong></div>{renderViewer(overlay)}</section><DockingWorkflowPanel adaptation={adaptation.snapshot} adaptationPhase={adaptation.phase} committed={Boolean(committedRegion)} /></div><DockingBottomPanel /></section>;
};
