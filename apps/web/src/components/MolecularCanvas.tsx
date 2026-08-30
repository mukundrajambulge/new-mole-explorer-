import type { ActionId } from "../domain/registry";
import { Icon } from "./Icon";

const bonds = [
  [118, 212, 185, 146], [185, 146, 262, 192], [262, 192, 335, 135], [335, 135, 407, 180], [407, 180, 480, 116], [480, 116, 557, 174], [557, 174, 640, 127], [640, 127, 700, 204],
  [98, 361, 176, 316], [176, 316, 244, 372], [244, 372, 328, 312], [328, 312, 402, 358], [402, 358, 474, 292], [474, 292, 550, 337], [550, 337, 630, 286], [630, 286, 704, 350],
  [142, 493, 220, 440], [220, 440, 301, 506], [301, 506, 380, 448], [380, 448, 454, 499], [454, 499, 532, 436], [532, 436, 618, 491], [618, 491, 699, 434],
  [263, 192, 244, 372], [407, 180, 402, 358], [557, 174, 550, 337], [328, 312, 301, 506], [474, 292, 454, 499],
];

const atoms = [
  [118, 212, "#7d8795", 6], [185, 146, "#dbe4ef", 8], [262, 192, "#2e83ff", 7], [335, 135, "#dbe4ef", 6], [407, 180, "#ff675f", 6], [480, 116, "#8792a2", 7], [557, 174, "#2e83ff", 6], [640, 127, "#bdc8d9", 8], [700, 204, "#ef765f", 5],
  [98, 361, "#aeb9c8", 7], [176, 316, "#2e83ff", 6], [244, 372, "#bdc8d9", 8], [328, 312, "#dbe4ef", 6], [402, 358, "#2e83ff", 7], [474, 292, "#f05ee9", 10], [550, 337, "#ff8354", 7], [630, 286, "#2e83ff", 6], [704, 350, "#dbe4ef", 8],
  [142, 493, "#758293", 5], [220, 440, "#bdc8d9", 7], [301, 506, "#2e83ff", 6], [380, 448, "#dbe4ef", 8], [454, 499, "#ff675f", 6], [532, 436, "#bdc8d9", 7], [618, 491, "#2e83ff", 6], [699, 434, "#bdc8d9", 6],
];

const ribbons = [
  "M 16 262 C 102 134, 134 112, 216 174 S 314 332, 392 228 S 502 98, 589 184 S 708 311, 790 178",
  "M 0 412 C 96 328, 153 387, 198 468 S 308 600, 376 482 S 497 331, 574 397 S 689 552, 808 420",
  "M 58 70 C 144 166, 215 84, 276 63 S 398 71, 442 20",
];

export const MolecularCanvas = ({ style, activeTool, onAction }: { style: string; activeTool: string; onAction: (actionId: ActionId) => void }) => (
  <section className="canvas-stage" aria-label="Molecular render projection">
    <div className="canvas-status"><span className="live-dot" />RENDER PROJECTION <span className="canvas-status-separator">/</span> G0 PREVIEW</div>
    <div className={`molecular-canvas molecular-canvas--${style.toLowerCase().replaceAll(" ", "-")}`}>
      <svg viewBox="0 0 800 640" role="img" aria-label="Non-authoritative molecular render projection preview" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="canvasGlow" cx="50%" cy="48%" r="62%"><stop offset="0" stopColor="#182a3e" stopOpacity=".72" /><stop offset=".65" stopColor="#090c12" stopOpacity=".44" /><stop offset="1" stopColor="#05070a" stopOpacity="0" /></radialGradient>
          <linearGradient id="ribbonGradient" x1="0" x2="1"><stop offset="0" stopColor="#536070" stopOpacity=".35" /><stop offset=".4" stopColor="#d0d8e4" stopOpacity=".82" /><stop offset="1" stopColor="#586473" stopOpacity=".38" /></linearGradient>
          <filter id="atomGlow"><feGaussianBlur stdDeviation="2.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <pattern id="microGrid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#93a9c2" strokeOpacity=".035" /></pattern>
        </defs>
        <rect width="800" height="640" fill="url(#microGrid)" />
        <ellipse cx="400" cy="300" rx="390" ry="302" fill="url(#canvasGlow)" />
        <g className="ribbon-layer" fill="none" stroke="url(#ribbonGradient)" strokeLinecap="round">
          {ribbons.map((ribbon) => <path key={ribbon} d={ribbon} strokeWidth="22" opacity=".58" />)}
          {ribbons.map((ribbon) => <path key={`${ribbon}-line`} d={ribbon} stroke="#eff4fb" strokeWidth="2" opacity=".34" />)}
        </g>
        <g className="bond-layer" stroke="#94a1b3" strokeOpacity=".62" strokeWidth="2">
          {bonds.map(([x1, y1, x2, y2], index) => <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />)}
          <path d="M 349 330 C 397 280, 451 242, 497 285 C 531 316, 507 379, 466 392 C 420 405, 379 377, 349 330 Z" fill="none" stroke="#b951e8" strokeDasharray="4 7" strokeOpacity=".76" />
          <path d="M 442 289 C 466 263, 501 264, 521 289" fill="none" stroke="#31d8c4" strokeDasharray="3 8" />
        </g>
        <g className="atom-layer" filter="url(#atomGlow)">
          {atoms.map(([cx, cy, color, radius], index) => <g key={index}><circle cx={cx} cy={cy} r={radius as number} fill={color as string} fillOpacity=".88" /><circle cx={(cx as number) - 2} cy={(cy as number) - 2} r={(radius as number) * .35} fill="#ffffff" fillOpacity=".7" /></g>)}
          <circle cx="452" cy="315" r="12" fill="#ed8e12" /><circle cx="448" cy="311" r="4" fill="#fff2c9" />
        </g>
        <g className="selection-ring" fill="none" stroke="#31d8c4" strokeWidth="1.5" strokeDasharray="2 5"><circle cx="452" cy="315" r="27" /><circle cx="452" cy="315" r="34" opacity=".35" /></g>
      </svg>
      <div className="canvas-empty-note"><span>Preview geometry only</span><small>Canonical molecular state is not loaded in G0</small></div>
      <div className="axis-widget" aria-label="Orientation axes"><span className="axis axis--y">Y</span><span className="axis axis--x">X</span><span className="axis axis--z">Z</span><span className="axis-origin" /></div>
      <button className="canvas-reset" onClick={() => onAction("VIEW.RESET")} aria-label="Reset view" data-action-id="VIEW.RESET"><Icon name="plus" size={16} /></button>
      <div className="canvas-tool-readout"><span className="tool-readout-icon"><Icon name={activeTool === "Select" ? "pointer" : activeTool === "Pan" ? "hand" : activeTool === "Rotate" ? "rotate" : "zoom"} size={13} /></span>{activeTool.toUpperCase()}</div>
    </div>
  </section>
);
