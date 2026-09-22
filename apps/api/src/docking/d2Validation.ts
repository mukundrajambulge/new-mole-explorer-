import type { D2Diagnostic, D2DiagnosticSeverity, D2ProvenanceRecordV1, D2SealResult, D2ValidationStatus } from "@molecular/contracts";

export const d2Error = (code: string, message: string, path?: string, objectRef?: string): D2Diagnostic => ({
  code,
  severity: "ERROR" satisfies D2DiagnosticSeverity,
  blocking: true,
  message,
  ...(path ? { path } : {}),
  ...(objectRef ? { objectRef } : {}),
});

export const d2Warning = (code: string, message: string, path?: string, objectRef?: string): D2Diagnostic => ({
  code,
  severity: "WARNING" satisfies D2DiagnosticSeverity,
  blocking: false,
  message,
  ...(path ? { path } : {}),
  ...(objectRef ? { objectRef } : {}),
});

const statusFor = (diagnostics: readonly D2Diagnostic[]): D2ValidationStatus => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.blocking);
  if (blocking.length === 0) return "VALID";
  if (blocking.some((diagnostic) => diagnostic.code.startsWith("RESOURCE_"))) return "RESOURCE_REJECTED";
  if (blocking.some((diagnostic) => diagnostic.code.startsWith("AMBIGUOUS_"))) return "AMBIGUOUS";
  if (blocking.some((diagnostic) => diagnostic.code.startsWith("UNSUPPORTED_"))) return "UNSUPPORTED";
  return "INVALID";
};

export const sealResult = <T>(value: T | undefined, diagnostics: readonly D2Diagnostic[], provenance?: D2ProvenanceRecordV1): D2SealResult<T> => {
  const status = statusFor(diagnostics);
  return Object.freeze({
    status,
    ...(status === "VALID" && value !== undefined ? { value } : {}),
    diagnostics: Object.freeze([...diagnostics]),
    ...(provenance ? { provenance } : {}),
  });
};

export const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  for (const member of Object.values(value as Record<string, unknown>)) deepFreeze(member);
  return Object.freeze(value);
};

export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const assertFiniteTuple = (values: readonly number[], path: string, diagnostics: D2Diagnostic[]): void => {
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) diagnostics.push(d2Error("INVALID_NONFINITE_VALUE", `${path}[${index}] must be finite.`, `${path}[${index}]`));
  });
};

export const assertNonEmpty = (value: string, code: string, message: string, path: string, diagnostics: D2Diagnostic[]): void => {
  if (!value.trim()) diagnostics.push(d2Error(code, message, path));
};
