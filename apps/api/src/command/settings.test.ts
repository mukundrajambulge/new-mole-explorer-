import { describe, expect, it } from "vitest";
import { SettingStore } from "./settings.js";

describe("R10 typed settings", () => {
  it("coerces, validates, scopes and restores defaults", () => {
    const store = new SettingStore();
    expect(store.set("orthoscopic", "on", "session").value?.value).toBe(true);
    expect(store.set("fov", 180, "session").diagnostic?.code).toBe("INVALID_SETTING");
    expect(store.set("background_color", "#102030", "scene", "scene-1").value?.value).toBe("#102030");
    expect(store.set("background_color", "red", "object", "object-1").diagnostic?.code).toBe("UNSUPPORTED_SETTING_SCOPE");
    expect(store.unset("orthoscopic", "session").ok).toBe(true);
    expect(store.get("orthoscopic", "session")?.value).toBe(false);
  });
});
