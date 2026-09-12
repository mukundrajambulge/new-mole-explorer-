import { useMemo, useState } from "react";
import type { BiologicalData } from "../biological/adapters";
import { Icon } from "./Icon";

type BiologicalDataViewerProps = { data: BiologicalData; onImport: () => void };

const sequenceColor = (symbol: string) => {
  const normalized = symbol.toUpperCase();
  if (normalized === "A") return "#2dd4bf";
  if (normalized === "C") return "#60a5fa";
  if (normalized === "G") return "#f59e0b";
  if (normalized === "T" || normalized === "U") return "#f472b6";
  return "#94a3b8";
};

const SequenceViewer = ({ data }: { data: Extract<BiologicalData, { kind: "SEQUENCE" | "SEQUENCE_QUALITY" }> }) => {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(data.records[0]?.id ?? "");
  const filtered = useMemo(() => data.records.filter((record) => !query.trim() || `${record.id} ${record.description} ${record.sequence}`.toLowerCase().includes(query.trim().toLowerCase())), [data.records, query]);
  const selected = data.records.find((record) => record.id === selectedId) ?? data.records[0];
  const qualities = selected?.quality ?? [];
  return <div className="bio-viewer-content bio-sequence-viewer" data-testid="sequence-viewer" data-sequence-format={data.format} data-sequence-alphabet={data.alphabet}>
    <div className="bio-viewer-toolbar"><div><span className="bio-eyebrow">SEQUENCE VIEWER</span><h2>{data.sourceName}</h2></div><span className="bio-status-badge">{data.alphabet} · {data.records.length} record{data.records.length === 1 ? "" : "s"}</span></div>
    <div className="bio-sequence-summary"><span><strong>{data.records.reduce((sum, record) => sum + record.sequence.length, 0).toLocaleString()}</strong> residues</span><label>Find sequence<input aria-label="Sequence search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, description, or motif" /></label><span>{filtered.length} match{filtered.length === 1 ? "" : "es"}</span></div>
    <div className="bio-sequence-layout"><div className="bio-record-list" role="listbox" aria-label="Sequence records">{filtered.map((record) => <button key={record.id} type="button" role="option" aria-selected={selected?.id === record.id} className={selected?.id === record.id ? "bio-record bio-record--active" : "bio-record"} onClick={() => setSelectedId(record.id)}><strong>{record.id}</strong><span>{record.description || "No description"}</span><small>{record.sequence.length.toLocaleString()} residues</small></button>)}</div>{selected && <div className="bio-sequence-detail"><div className="bio-record-heading"><div><span className="bio-eyebrow">RECORD</span><h3>{selected.id}</h3><p>{selected.description || "No description supplied"}</p></div><span className="bio-mono">{selected.sequence.length.toLocaleString()} aa/nt</span></div><div className="bio-sequence-strip" aria-label="Sequence characters">{[...selected.sequence.slice(0, 4000)].map((symbol, index) => <span key={`${symbol}-${index}`} title={`${index + 1}: ${symbol}`} style={{ color: sequenceColor(symbol) }}>{symbol}</span>)}{selected.sequence.length > 4000 && <em>… {selected.sequence.length - 4000} more</em>}</div>{data.kind === "SEQUENCE_QUALITY" && <div className="bio-quality-panel"><div className="bio-record-heading"><strong>Read quality</strong><span>Phred+33 · {qualities.length.toLocaleString()} scores</span></div><div className="bio-quality-strip">{qualities.slice(0, 4000).map((quality, index) => <span key={`${quality}-${index}`} title={`Position ${index + 1}: Q${quality}`} style={{ opacity: Math.max(0.18, Math.min(1, quality / 40)) }} />)}</div></div>}</div>}</div>
  </div>;
};

const MapViewer = ({ data }: { data: Extract<BiologicalData, { kind: "MAP" }> }) => {
  const { grid } = data;
  const [slice, setSlice] = useState(0);
  const dimensions = grid.dimensions;
  const planeSize = dimensions[0] * dimensions[1];
  const start = Math.min(grid.values.length - 1, slice * planeSize);
  const plane = grid.values.slice(start, start + planeSize);
  const sample = plane.slice(0, 2048);
  const columns = Math.max(1, Math.min(64, dimensions[0]));
  return <div className="bio-viewer-content bio-map-viewer" data-testid="map-viewer" data-map-format={data.format} data-map-complete={grid.dataComplete ? "true" : "false"}>
    <div className="bio-viewer-toolbar"><div><span className="bio-eyebrow">DENSITY MAP VIEWER</span><h2>{data.sourceName}</h2></div><span className="bio-status-badge">{data.encoding}</span></div>
    <div className="bio-map-summary"><div><span>Grid</span><strong>{dimensions.join(" × ")}</strong></div><div><span>Origin</span><strong>{grid.origin.map((value) => value.toFixed(2)).join(", ")} Å</strong></div><div><span>Spacing</span><strong>{grid.spacing.map((value) => value.toFixed(3)).join(", ")} Å</strong></div><div><span>Range</span><strong>{grid.valueRange.min.toFixed(3)} … {grid.valueRange.max.toFixed(3)}</strong></div></div>
    <div className="bio-map-controls"><label>Frame / Z slice <input aria-label="Map slice" type="range" min="0" max={Math.max(0, dimensions[2] - 1)} value={slice} onChange={(event) => setSlice(Number(event.target.value))} /><output>{slice + 1} / {dimensions[2]}</output></label><span>{grid.valueCount.toLocaleString()} voxels · mean {grid.valueRange.mean.toFixed(3)}</span></div>
    <div className="bio-map-preview" aria-label="Density map preview" style={{ gridTemplateColumns: `repeat(${columns}, minmax(2px, 1fr))` }}>{sample.map((value, index) => { const range = grid.valueRange.max - grid.valueRange.min || 1; const normalized = Math.max(0, Math.min(1, (value - grid.valueRange.min) / range)); return <span key={`${index}-${value}`} style={{ opacity: 0.12 + normalized * 0.88, backgroundColor: normalized > 0.72 ? "#f59e0b" : normalized > 0.42 ? "#38bdf8" : "#1e3a8a" }} />; })}</div>
    {!grid.dataComplete && <p className="bio-warning">The source declared more voxels than were supplied. The viewer keeps the incomplete payload visible and marks it explicitly.</p>}
  </div>;
};

const TrajectoryViewer = ({ data }: { data: Extract<BiologicalData, { kind: "TRAJECTORY" }> }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = data.frames[frameIndex];
  const ready = data.status === "READY" && Boolean(frame);
  const bounds = ready ? { minX: Math.min(...frame!.atoms.map((atom) => atom.x)), maxX: Math.max(...frame!.atoms.map((atom) => atom.x)), minY: Math.min(...frame!.atoms.map((atom) => atom.y)), maxY: Math.max(...frame!.atoms.map((atom) => atom.y)) } : null;
  return <div className="bio-viewer-content bio-trajectory-viewer" data-testid="trajectory-viewer" data-trajectory-format={data.format} data-trajectory-status={data.status}>
    <div className="bio-viewer-toolbar"><div><span className="bio-eyebrow">TRAJECTORY VIEWER</span><h2>{data.sourceName}</h2></div><span className={data.status === "READY" ? "bio-status-badge" : "bio-status-badge bio-status-badge--warning"}>{data.status}</span></div>
    <div className="bio-trajectory-summary"><div><span>Frames</span><strong>{data.frames.length ? data.frames.length.toLocaleString() : "Header only"}</strong></div><div><span>Atoms / frame</span><strong>{data.atomCount.toLocaleString()}</strong></div><div><span>Units</span><strong>Å (viewer)</strong></div><div><span>Source</span><strong>{data.format.toUpperCase()}</strong></div></div>
    {ready && frame && <><div className="bio-map-controls"><label>Frame <input aria-label="Trajectory frame" type="range" min="0" max={data.frames.length - 1} value={frameIndex} onChange={(event) => setFrameIndex(Number(event.target.value))} /><output>{frameIndex + 1} / {data.frames.length}</output></label><span>{frame.label}</span></div><div className="bio-trajectory-preview" aria-label="Trajectory coordinate preview"><svg viewBox="0 0 600 360" role="img" aria-label={`Frame ${frameIndex + 1} XY projection`}>{frame.atoms.map((atom) => { const x = ((atom.x - bounds!.minX) / ((bounds!.maxX - bounds!.minX) || 1)) * 540 + 30; const y = 330 - ((atom.y - bounds!.minY) / ((bounds!.maxY - bounds!.minY) || 1)) * 300; return <circle key={atom.index} cx={x} cy={y} r="4" fill={sequenceColor(atom.element)} />; })}</svg></div><div className="bio-atom-table"><span>Index</span><span>Element</span><span>X</span><span>Y</span><span>Z</span>{frame.atoms.slice(0, 24).map((atom) => <div key={atom.index} className="bio-atom-row"><span>{atom.index + 1}</span><span>{atom.element}</span><span>{atom.x.toFixed(3)}</span><span>{atom.y.toFixed(3)}</span><span>{atom.z.toFixed(3)}</span></div>)}</div></>}
    {!ready && <div className="bio-header-only"><Icon name="circleHelp" size={22} /><strong>Coordinate frames are not decoded for this source yet.</strong><p>{data.diagnostic ?? "The source was identified and its metadata was validated."}</p></div>}
  </div>;
};

const TopologyViewer = ({ data }: { data: Extract<BiologicalData, { kind: "TOPOLOGY" }> }) => <div className="bio-viewer-content bio-topology-viewer" data-testid="topology-viewer" data-topology-format={data.format} data-topology-status={data.status}><div className="bio-viewer-toolbar"><div><span className="bio-eyebrow">TOPOLOGY VIEWER</span><h2>{data.sourceName}</h2></div><span className="bio-status-badge">{data.status}</span></div><div className="bio-trajectory-summary"><div><span>Atoms</span><strong>{data.atomCount.toLocaleString()}</strong></div><div><span>Bonds</span><strong>{data.bondCount === null ? "Not declared" : data.bondCount.toLocaleString()}</strong></div><div><span>Residues</span><strong>{data.residueCount === null ? "Not declared" : data.residueCount.toLocaleString()}</strong></div></div><div className="bio-header-only"><Icon name="layers" size={22} /><strong>Topology is kept separate from coordinate rendering.</strong><p>{data.diagnostic ?? "No atomic coordinates were fabricated from this topology source. Pair it with a validated coordinate trajectory in a future workspace session."}</p></div></div>;

const SmilesViewer = ({ data }: { data: Extract<BiologicalData, { kind: "SMILES" }> }) => <div className="bio-viewer-content bio-smiles-viewer" data-testid="smiles-viewer"><div className="bio-viewer-toolbar"><div><span className="bio-eyebrow">SMILES RECORD VIEWER</span><h2>{data.sourceName}</h2></div><span className="bio-status-badge">{data.records.length} record{data.records.length === 1 ? "" : "s"}</span></div><div className="bio-smiles-list">{data.records.map((record) => <div key={record.id} className="bio-smiles-record"><span>{record.name || record.id}</span><code>{record.notation}</code><small>No coordinates inferred from text notation.</small></div>)}</div></div>;

export const BiologicalDataViewer = ({ data, onImport }: BiologicalDataViewerProps) => <section className="canvas-stage biological-data-stage" aria-label="Biological data viewer"><div className="canvas-status"><span className="live-dot" />{data.kind.replace("_", " ")} DATA</div><div className="biological-data-shell"><div className="biological-data-header"><div><strong>Biological data</strong><span>Typed adapter output · source semantics preserved</span></div><button type="button" onClick={onImport}><Icon name="upload" size={14} /> Open another dataset</button></div>{data.kind === "SEQUENCE" || data.kind === "SEQUENCE_QUALITY" ? <SequenceViewer data={data} /> : data.kind === "MAP" ? <MapViewer data={data} /> : data.kind === "TRAJECTORY" ? <TrajectoryViewer data={data} /> : data.kind === "TOPOLOGY" ? <TopologyViewer data={data} /> : <SmilesViewer data={data} />}</div></section>;

export type { BiologicalDataViewerProps };
