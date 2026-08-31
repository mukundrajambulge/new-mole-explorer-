import { describe, expect, it } from "vitest";
import { applyPresentationAction } from "./presentationActions";
import { createDefaultRenderProjection, setColorScheme, setProjectionStyle } from "./presentationState";

describe("G1C shared presentation actions", () => {
  it("routes representation and color operations through the same projection state", () => {
    const initial = createDefaultRenderProjection();
    const viaAction = applyPresentationAction(initial, null, { type: "REPRESENTATION.APPLY", style: "ball-and-stick" });
    expect(viaAction).toEqual(setProjectionStyle(initial, null, "ball-and-stick"));

    const colored = applyPresentationAction(viaAction, null, { type: "COLOR.APPLY_SCHEME", mode: "modern-jmol" });
    expect(colored).toEqual(setColorScheme(viaAction, "modern-jmol"));
  });

  it("uses one component visibility operation for every UI surface", () => {
    const initial = createDefaultRenderProjection();
    const hidden = applyPresentationAction(initial, null, { type: "COMPONENT_VISIBILITY.SET", component: "protein", visible: false });
    expect(hidden.showProtein).toBe(false);
    expect(hidden.showLigand).toBe(true);
    const customBackground = applyPresentationAction(hidden, null, { type: "BACKGROUND.SET", preset: "Custom", color: "#123456" });
    expect(customBackground.background).toEqual({ preset: "Custom", color: "#123456" });
  });
});
