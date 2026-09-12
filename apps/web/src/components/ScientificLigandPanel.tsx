import type { StructureLoadResult } from "@molecular/contracts";
import { ACTION_IDS, type ActionId } from "../domain/registry";
import type { SelectionResult } from "../interaction/selectionResolver";

type ScientificLigandPanelProps = {
  structure: StructureLoadResult | null;
  activeSelection: SelectionResult | null;
  onAction: (actionId: ActionId) => void;
  onCommand: (command: string) => void;
};

/** Contextual ligand workflow backed by the same canonical selection and analysis services as the console. */
export const ScientificLigandPanel = ({ structure, activeSelection, onAction, onCommand }: ScientificLigandPanelProps) => {
  const ligandCount = structure?.structure.counts.ligandAtoms ?? 0;
  const selectedLigandCount = activeSelection && structure
    ? activeSelection.stableAtomIds.filter((stableId) => {
      const localId = stableId.includes("::") ? stableId.slice(stableId.indexOf("::") + 2) : stableId;
      return structure.structure.atoms.some((atom) => atom.stableId === localId && atom.isLigand);
    }).length
    : 0;
  const hasLigand = ligandCount > 0;
  return <section className="panel-card ligand-context-card" data-testid="ligand-interaction-panel">
    <div className="panel-heading"><div><h2>Ligand interactions</h2><small>Canonical proximity diagnostics</small></div><span className="measurement-count">{ligandCount}</span></div>
    {!structure ? <div className="measurement-empty">Load a structure to inspect ligand context.</div> : !hasLigand ? <div className="measurement-empty">No ligand atoms are present in the active object.</div> : <>
      <div className="ligand-context-summary"><span className="eyebrow">ACTIVE LIGAND CONTEXT</span><strong>{selectedLigandCount ? `${selectedLigandCount} ligand atoms selected` : `${ligandCount} ligand atoms available`}</strong><small>All results stay tied to the current coordinate revision.</small></div>
      <div className="ligand-action-grid">
        <button type="button" className="quick-tool" onClick={() => onCommand("select ligand")}><span className="quick-icon">L</span><span>Select ligand</span><small>Canonical ligand atoms</small></button>
        <button type="button" className="quick-tool" onClick={() => onCommand("select byres (within 4 of ligand)")}><span className="quick-icon">⌂</span><span>Binding shell</span><small>Residues within 4 Å</small></button>
        <button type="button" className="quick-tool" onClick={() => onAction(ACTION_IDS.ANALYSIS_H_BONDS)}><span className="quick-icon">H</span><span>H-bonds</span><small>Bounded 3.5 Å donor–acceptor</small></button>
        <button type="button" className="quick-tool" onClick={() => onAction(ACTION_IDS.ANALYSIS_CONTACTS)}><span className="quick-icon">C</span><span>Contacts</span><small>Bounded 4 Å heavy atoms</small></button>
        <button type="button" className="quick-tool" onClick={() => onAction(ACTION_IDS.ANALYSIS_CLASH)}><span className="quick-icon">!</span><span>Clashes</span><small>VDW overlap &gt; 0.4 Å</small></button>
      </div>
      <div className="presentation-diagnostic">Interaction labels are classified from canonical coordinates and declared chemistry roles; no docking pose or binding affinity is inferred.</div>
    </>}
  </section>;
};
