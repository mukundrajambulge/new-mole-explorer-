import { describe, expect, it } from "vitest";
import { SettingStore } from "./settings.js";

describe("R10 typed settings", () => {
  it("coerces, validates, scopes and restores defaults", () => {
    const store = new SettingStore();
    expect(store.set("orthoscopic", "on", "GLOBAL").value?.value).toBe(true);
    expect(store.set("camera_up", [0, 0, 1], "GLOBAL").value?.value).toEqual([0, 0, 1]);
    expect(store.set("fov", 180, "GLOBAL").diagnostic?.code).toBe("INVALID_SETTING");
    expect(store.set("cartoon_color", "#102030", "ATOM_SELECTION", "selection-1").value?.value).toBe("#102030");
    expect(store.set("background_color", "red", "OBJECT", "object-1").diagnostic?.code).toBe("UNSUPPORTED_SETTING_SCOPE");
    expect(store.getResult("background_color", "OBJECT", "object-1").diagnostic?.code).toBe("UNSUPPORTED_SETTING_SCOPE");
    expect(store.unset("representation", "GLOBAL").diagnostic?.code).toBe("UNSUPPORTED_SETTING_SCOPE");
    expect(store.unset("orthoscopic", "GLOBAL").ok).toBe(true);
    expect(store.get("orthoscopic", "GLOBAL")?.value).toBe(false);
  });
});
