import type { JsonValue, SettingScope, SettingSpec, SettingValue } from "@molecular/contracts";
import { SETTING_SCOPES } from "@molecular/contracts";

export const SETTING_REGISTRY: readonly SettingSpec[] = [
  { name: "cartoon_color", aliases: ["ribbon_color"], valueType: "color", scope: ["GLOBAL", "OBJECT", "OBJECT_STATE", "ATOM_SELECTION", "BOND_SELECTION"], defaultValue: "inherit", version: "r10-settings.v1", inheritance: "GLOBAL_THEN_SELECTION", classification: "PRESENTATION", description: "Representation-scoped cartoon/ribbon color.", capabilityState: "SUPPORTED_WITH_LIMITATIONS" },
  { name: "background_color", aliases: ["bg_color", "bg_colour"], valueType: "color", scope: ["GLOBAL"], defaultValue: "#000000", version: "r10-settings.v1", inheritance: "DEFAULT", classification: "PRESENTATION", description: "Renderer-neutral scene background color.", capabilityState: "SUPPORTED" },
  { name: "orthoscopic", aliases: ["orthographic"], valueType: "boolean", scope: ["GLOBAL"], defaultValue: false, version: "r10-settings.v1", inheritance: "DEFAULT", classification: "PRESENTATION", description: "Use orthographic camera projection.", capabilityState: "SUPPORTED" },
  { name: "field_of_view", aliases: ["fov"], valueType: "float", scope: ["GLOBAL"], defaultValue: 20, min: 1, max: 179, version: "r10-settings.v1", inheritance: "DEFAULT", classification: "PRESENTATION", description: "Perspective camera field of view in degrees.", capabilityState: "SUPPORTED" },
  { name: "camera_up", aliases: ["up_vector"], valueType: "float3", scope: ["GLOBAL"], defaultValue: [0, 1, 0], version: "r10-settings.v1", inheritance: "DEFAULT", classification: "PRESENTATION", description: "Renderer-neutral camera up vector.", capabilityState: "SUPPORTED_WITH_LIMITATIONS" },
  { name: "representation", aliases: ["rep"], valueType: "enum", scope: ["OBJECT", "OBJECT_STATE", "ATOM_SELECTION", "BOND_SELECTION"], defaultValue: "sticks", enumValues: ["lines", "sticks", "spheres", "ball-and-stick", "cartoon", "surface", "mesh", "dots"], version: "r10-settings.v1", inheritance: "GLOBAL_THEN_OBJECT", classification: "PRESENTATION", description: "Renderer-neutral representation profile.", capabilityState: "SUPPORTED_WITH_LIMITATIONS" },
  { name: "label_expression", aliases: ["label"], valueType: "string", scope: ["OBJECT", "OBJECT_STATE", "ATOM_SELECTION"], defaultValue: "{name}", version: "r10-settings.v1", inheritance: "GLOBAL_THEN_SELECTION", classification: "PRESENTATION", description: "Safe label field template; never evaluated as code.", capabilityState: "SUPPORTED_WITH_LIMITATIONS" },
  { name: "coordinate_frame", aliases: ["frame_policy"], valueType: "enum", scope: ["GLOBAL"], defaultValue: "LOCAL_SCIENTIFIC", enumValues: ["LOCAL_SCIENTIFIC", "EFFECTIVE_WORLD"], version: "r10-settings.v1", inheritance: "DEFAULT", classification: "SCIENTIFIC", description: "Explicit cross-object coordinate frame policy.", capabilityState: "SUPPORTED" },
  { name: "max_command_statements", aliases: [], valueType: "integer", scope: ["GLOBAL"], defaultValue: 32, min: 1, max: 32, version: "r10-settings.v1", inheritance: "DEFAULT", classification: "LIFECYCLE", description: "Bounded safe command batch size.", capabilityState: "SUPPORTED" },
];

const normalize = (name: string): string => name.trim().toLowerCase().replace(/-/g, "_");
export const settingSpecFor = (name: string): SettingSpec | undefined => {
  const normalized = normalize(name);
  return SETTING_REGISTRY.find((spec) => spec.name === normalized || spec.aliases.some((alias) => normalize(alias) === normalized));
};

export type SettingDiagnostic = { code: "INVALID_SETTING" | "UNSUPPORTED_SETTING_SCOPE"; message: string };

const coerce = (spec: SettingSpec, raw: JsonValue): { value?: JsonValue; diagnostic?: SettingDiagnostic } => {
  if (spec.valueType === "string" || spec.valueType === "color") {
    if (typeof raw !== "string") return { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} requires text.` } };
    if (spec.valueType === "color" && raw !== "inherit" && !/^#[0-9a-f]{6}$/i.test(raw) && !/^[a-z][a-z0-9-]*$/i.test(raw)) return { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} requires a named color or #RRGGBB.` } };
    return { value: raw };
  }
  if (spec.valueType === "boolean") {
    if (typeof raw === "boolean") return { value: raw };
    if (typeof raw === "string" && ["true", "on", "1"].includes(raw.toLowerCase())) return { value: true };
    if (typeof raw === "string" && ["false", "off", "0"].includes(raw.toLowerCase())) return { value: false };
    return { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} requires boolean true/false.` } };
  }
  if (spec.valueType === "float" || spec.valueType === "integer") {
    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(value) || (spec.valueType === "integer" && !Number.isInteger(value)) || (spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) return { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} is outside its bounded numeric range.` } };
    return { value };
  }
  if (spec.valueType === "float3") {
    if (!Array.isArray(raw) || raw.length !== 3 || raw.some((component) => typeof component !== "number" || !Number.isFinite(component))) return { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} requires three finite numbers.` } };
    return { value: raw };
  }
  if (spec.valueType === "enum") {
    const value = String(raw).toUpperCase();
    const match = spec.enumValues?.find((option) => option.toUpperCase() === value);
    return match ? { value: match } : { diagnostic: { code: "INVALID_SETTING", message: `${spec.name} must be one of ${spec.enumValues?.join(", ") ?? "the declared values"}.` } };
  }
  return { diagnostic: { code: "INVALID_SETTING", message: `Unsupported setting type for ${spec.name}.` } };
};

export class SettingStore {
  private readonly values = new Map<string, SettingValue>();

  constructor() {
    for (const spec of SETTING_REGISTRY) this.values.set(this.key(spec.name, "GLOBAL"), { name: spec.name, value: spec.defaultValue, scope: "GLOBAL", revision: 0 });
  }

  private key(name: string, scope: SettingScope, targetId?: string): string { return `${normalize(name)}:${scope}:${targetId ?? ""}`; }
  set(name: string, raw: JsonValue, scope: SettingScope = "GLOBAL", targetId?: string): { value?: SettingValue; diagnostic?: SettingDiagnostic } {
    const spec = settingSpecFor(name);
    if (!spec) return { diagnostic: { code: "INVALID_SETTING", message: `Unknown setting ${name}.` } };
    if (!spec.scope.includes(scope)) return { diagnostic: { code: "UNSUPPORTED_SETTING_SCOPE", message: `${spec.name} does not support ${scope} scope.` } };
    if (scope !== "GLOBAL" && !targetId) return { diagnostic: { code: "INVALID_SETTING", message: `${scope} scope requires a stable target ID.` } };
    const coerced = coerce(spec, raw);
    if (coerced.diagnostic) return { diagnostic: coerced.diagnostic };
    const current = this.values.get(this.key(spec.name, scope, targetId));
    const value: SettingValue = { name: spec.name, value: coerced.value ?? null, scope, ...(targetId ? { targetId } : {}), revision: (current?.revision ?? 0) + 1 };
    this.values.set(this.key(spec.name, scope, targetId), value);
    return { value };
  }

  get(name: string, scope: SettingScope = "GLOBAL", targetId?: string): SettingValue | undefined {
    const spec = settingSpecFor(name);
    if (!spec) return undefined;
    return this.values.get(this.key(spec.name, scope, targetId)) ?? this.values.get(this.key(spec.name, "GLOBAL")) ?? { name: spec.name, value: spec.defaultValue, scope: "GLOBAL", revision: 0 };
  }

  getResult(name: string, scope: SettingScope = "GLOBAL", targetId?: string): { value?: SettingValue; diagnostic?: SettingDiagnostic } {
    const spec = settingSpecFor(name);
    if (!spec) return { diagnostic: { code: "INVALID_SETTING", message: `Unknown setting ${name}.` } };
    if (!spec.scope.includes(scope)) return { diagnostic: { code: "UNSUPPORTED_SETTING_SCOPE", message: `${spec.name} does not support ${scope} scope.` } };
    if (scope !== "GLOBAL" && !targetId) return { diagnostic: { code: "INVALID_SETTING", message: `${scope} scope requires a stable target ID.` } };
    return { value: this.get(spec.name, scope, targetId) };
  }

  unset(name: string, scope: SettingScope = "GLOBAL", targetId?: string): { ok: boolean; diagnostic?: SettingDiagnostic } {
    const spec = settingSpecFor(name);
    if (!spec) return { ok: false, diagnostic: { code: "INVALID_SETTING", message: `Unknown setting ${name}.` } };
    if (!spec.scope.includes(scope)) return { ok: false, diagnostic: { code: "UNSUPPORTED_SETTING_SCOPE", message: `${spec.name} does not support ${scope} scope.` } };
    if (scope !== "GLOBAL" && !targetId) return { ok: false, diagnostic: { code: "INVALID_SETTING", message: `${scope} scope requires a stable target ID.` } };
    this.values.delete(this.key(spec.name, scope, targetId));
    return { ok: true };
  }

  snapshot(): readonly SettingValue[] { return [...this.values.values()].sort((a, b) => `${a.name}:${a.scope}:${a.targetId ?? ""}`.localeCompare(`${b.name}:${b.scope}:${b.targetId ?? ""}`)); }
  scopes(): readonly SettingScope[] { return SETTING_SCOPES; }
}
