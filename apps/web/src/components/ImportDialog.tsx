import { useRef, useState } from "react";
import type { BiologicalFormat } from "../biological/adapters";
import { Icon } from "./Icon";

type ImportDialogProps = {
  onClose: () => void;
  onFile: (file: File) => void;
  onPaste: (filename: string, format: BiologicalFormat, text: string) => void;
  onOnline: (provider: "RCSB" | "PubChem" | "UniProt", accession: string) => void;
  busy?: boolean;
  error?: string | null;
};

type ImportTab = "LOCAL_FILE" | "ONLINE_ID" | "PASTE_TEXT";

const tabLabels: Record<ImportTab, string> = { LOCAL_FILE: "Local file", ONLINE_ID: "Online ID", PASTE_TEXT: "Paste / text" };

export const ImportDialog = ({ onClose, onFile, onPaste, onOnline, busy = false, error }: ImportDialogProps) => {
  const [tab, setTab] = useState<ImportTab>("LOCAL_FILE");
  const [format, setFormat] = useState<BiologicalFormat>("fasta");
  const [filename, setFilename] = useState("pasted-data.fasta");
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<"RCSB" | "PubChem" | "UniProt">("RCSB");
  const [accession, setAccession] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formatChanged = (value: BiologicalFormat) => { setFormat(value); if (value === "fasta") setFilename("pasted-data.fasta"); else if (value === "fastq") setFilename("pasted-data.fastq"); else if (value === "dx") setFilename("pasted-map.dx"); else if (value === "smiles") setFilename("pasted-data.smi"); };
  return <div className="import-dialog-backdrop" role="presentation"><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" data-testid="biological-import-dialog"><div className="import-dialog-heading"><div><span className="bio-eyebrow">FILE ADAPTER REGISTRY</span><h2 id="import-dialog-title">Open biological data</h2><p>Detect, validate, and route each source to its scientific viewer.</p></div><button className="icon-button" type="button" aria-label="Close import dialog" onClick={onClose}><Icon name="x" size={18} /></button></div><div className="import-dialog-tabs" role="tablist" aria-label="Import source"><>{(Object.keys(tabLabels) as ImportTab[]).map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "import-dialog-tab import-dialog-tab--active" : "import-dialog-tab"} onClick={() => setTab(key)}>{tabLabels[key]}</button>)}</></div>{tab === "LOCAL_FILE" && <div className="import-dialog-pane" role="tabpanel"><div className="import-drop-card"><Icon name="upload" size={28} /><strong>Choose a biological data file</strong><span>Structures continue through canonical coordinate ingestion; sequences, maps, trajectories, and topology use dedicated viewers.</span><button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Choose file</button><input ref={fileRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,.pqr,.sdf,.mol,.xyz,.mol2,.pdbqt,.fasta,.fa,.fna,.faa,.fastq,.fq,.gb,.gbk,.genbank,.embl,.emb,.dx,.mrc,.map,.ccp4,.dcd,.xtc,.trr,.gro,.psf,.prmtop,.prm7,.smi,.smiles,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} /></div><p className="import-format-note">Supported biological adapters: FASTA · FASTQ · GenBank · EMBL · OpenDX · MRC/CCP4 · XYZ trajectory · GRO · DCD/TRR frames · XTC header · PSF · PRMTOP · SMILES.</p></div>}{tab === "ONLINE_ID" && <div className="import-dialog-pane" role="tabpanel"><label>Provider<select aria-label="Online provider" value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="RCSB">RCSB PDB · structure</option><option value="PubChem">PubChem · small molecule</option><option value="UniProt">UniProt · sequence</option></select></label><label>Accession or name<input aria-label="Online accession" value={accession} onChange={(event) => setAccession(event.target.value)} placeholder={provider === "RCSB" ? "4DJW" : provider === "UniProt" ? "P01308" : "aspirin"} /></label><button className="import-primary-button" type="button" disabled={busy || !accession.trim()} onClick={() => onOnline(provider, accession.trim())}>{busy ? "Fetching…" : "Fetch and open"}</button><p className="import-format-note">The selected provider is recorded in source provenance. Ambiguous IDs are rejected instead of guessed.</p></div>}{tab === "PASTE_TEXT" && <div className="import-dialog-pane" role="tabpanel"><div className="import-inline-fields"><label>Format<select aria-label="Pasted data format" value={format} onChange={(event) => formatChanged(event.target.value as BiologicalFormat)}><option value="fasta">FASTA sequence</option><option value="fastq">FASTQ read</option><option value="genbank">GenBank sequence</option><option value="embl">EMBL sequence</option><option value="dx">OpenDX density map</option><option value="smiles">SMILES notation</option><option value="xyz-trajectory">XYZ trajectory</option><option value="gro">GRO coordinate frame</option><option value="psf">PSF topology</option><option value="prmtop">AMBER PRMTOP topology</option></select></label><label>Source filename<input aria-label="Pasted data filename" value={filename} onChange={(event) => setFilename(event.target.value)} /></label></div><label>Data<textarea aria-label="Pasted biological data" value={text} onChange={(event) => setText(event.target.value)} placeholder={format === "fasta" ? ">sequence-1\nMPEPTIDE" : format === "smiles" ? "CCO" : "Paste source text here"} rows={12} /></label><button className="import-primary-button" type="button" disabled={busy || !text.trim()} onClick={() => onPaste(filename || `pasted-data.${format}`, format, text)}>Validate and open</button></div>}{error && <p className="import-error" role="alert">{error}</p>}</section></div>;
};

export type { ImportDialogProps };

