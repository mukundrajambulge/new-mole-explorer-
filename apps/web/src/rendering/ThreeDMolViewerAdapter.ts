import {
  createViewer,
  type AtomSelectionSpec,
  type AtomSpec,
  type AtomStyleSpec,
  type GLViewer,
} from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import type { RenderProjection, RepresentationStyle } from "./renderProjection";

const selection = (predicate: (atom: AtomSpec) => boolean): AtomSelectionSpec => ({ predicate });

const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();

const styleFor = (representation: RepresentationStyle): AtomStyleSpec => {
  switch (representation) {
    case "lines":
      return { line: { color: "#b8c2cf", linewidth: 1 } };
    case "sticks":
      return { stick: { radius: 0.16, colorscheme: "Jmol" } };
    case "spheres":
      return { sphere: { scale: 0.3, colorscheme: "Jmol" } };
    case "ball-and-stick":
      return { stick: { radius: 0.16, colorscheme: "Jmol" }, sphere: { scale: 0.28, colorscheme: "Jmol" } };
    case "cartoon":
      return { cartoon: { color: "spectrum", arrows: true, opacity: 0.92 } };
  }
};

const waterStyle = (representation: RepresentationStyle, visible: boolean): AtomStyleSpec => {
  if (!visible) return { line: { hidden: true }, stick: { hidden: true }, sphere: { hidden: true }, cartoon: { hidden: true } };
  return representation === "cartoon" ? { sphere: { scale: 0.22, colorscheme: "Jmol" } } : styleFor(representation);
};

export class ThreeDMolViewerAdapter {
  private viewer: GLViewer | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hasModel = false;
  private structure: CanonicalMolecularStructure | null = null;
  private projection: RenderProjection | null = null;

  mount(container: HTMLElement): void {
    if (this.viewer && this.container === container) return;
    const mountedAdapter = mountedAdapters.get(container);
    if (mountedAdapter && mountedAdapter !== this) mountedAdapter.destroy();
    if (this.viewer) this.destroy();
    this.container = container;
    mountedAdapters.set(container, this);
    this.viewer = createViewer(container, {
      backgroundColor: "#05070a",
      antialias: true,
      disableFog: true,
      cartoonQuality: 8,
    });
    this.resizeObserver = new ResizeObserver(() => {
      this.viewer?.resize();
      this.viewer?.render();
    });
    this.resizeObserver.observe(container);
  }

  load(result: StructureLoadResult, projection: RenderProjection): void {
    this.ensureMounted();
    this.structure = result.structure;
    this.viewer!.removeAllModels();
    this.viewer!.addModel(result.renderSource.content, result.renderSource.format === "mmcif" ? "cif" : "pdb");
    this.hasModel = true;
    this.setProjection(projection);
    this.viewer!.zoomTo();
    this.viewer!.render();
  }

  setProjection(projection: RenderProjection): void {
    this.ensureMounted();
    this.projection = projection;
    this.viewer!.setBackgroundColor(projection.backgroundColor, 1);
    if (!this.hasModel) {
      this.viewer!.render();
      return;
    }
    this.applyProjection(projection);
    this.viewer!.render();
  }

  resize(): void {
    this.viewer?.resize();
    this.viewer?.render();
  }

  rotate(angle = 15): void {
    this.viewer?.rotate(angle, "y");
    this.viewer?.render();
  }

  pan(x = 70, y = 0): void {
    this.viewer?.translate(x, y);
    this.viewer?.render();
  }

  zoom(factor = 1.2): void {
    this.viewer?.zoom(factor);
    this.viewer?.render();
  }

  focus(): void {
    this.viewer?.zoomTo();
    this.viewer?.render();
  }

  destroy(): void {
    if (this.container && mountedAdapters.get(this.container) === this) mountedAdapters.delete(this.container);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.viewer) {
      this.viewer.clear();
      this.viewer = null;
    }
    this.container?.replaceChildren();
    this.container = null;
    this.hasModel = false;
    this.structure = null;
    this.projection = null;
  }

  private ensureMounted(): void {
    if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted.");
  }

  private applyProjection(projection: RenderProjection): void {
    const viewer = this.viewer!;
    const canonical = this.structure!.atoms;
    const canonicalSelection = (predicate: (atom: CanonicalMolecularStructure["atoms"][number]) => boolean): AtomSelectionSpec => {
      const matchingSerials = new Set(canonical.filter(predicate).map((atom) => atom.serial));
      const matchingIndices = new Set(canonical.map((atom, index) => predicate(atom) ? index : -1).filter((index) => index >= 0));
      return selection((atom) => (atom.serial !== undefined && matchingSerials.has(atom.serial)) || (atom.index !== undefined && matchingIndices.has(atom.index)));
    };
    // Entity membership comes from the backend canonical structure.  3Dmol is only
    // queried for the corresponding atom identity so it cannot redefine the science.
    const polymer = canonicalSelection((atom) => atom.isPolymer);
    const ligand = canonicalSelection((atom) => atom.isLigand);
    const water = canonicalSelection((atom) => atom.isWater);
    const ions = canonicalSelection((atom) => atom.isIon);
    const other = canonicalSelection((atom) => !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon);
    const style = styleFor(projection.representation);

    // Clear all previous display styles before applying targeted entity styles.
    // This keeps a representation change from leaking into an unrelated layer.
    viewer.setStyle({}, {});
    if (projection.showProtein) viewer.setStyle(polymer, projection.representation === "cartoon" ? style : style);
    if (projection.showLigand) viewer.setStyle(ligand, projection.representation === "cartoon" ? { stick: { radius: 0.18, colorscheme: "Jmol" } } : style);
    if (projection.showIons) viewer.setStyle(ions, projection.representation === "cartoon" ? { sphere: { radius: 0.55, colorscheme: "Jmol" } } : style);
    if (projection.showOther) viewer.setStyle(other, style);
    viewer.setStyle(water, waterStyle(projection.representation, projection.showWater));
  }
}
