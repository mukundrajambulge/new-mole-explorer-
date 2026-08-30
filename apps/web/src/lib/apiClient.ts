import type { BootstrapResponse, HealthResponse } from "@molecular/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return (await response.json()) as T;
};

export const apiClient = {
  health: () => request<HealthResponse>("/health"),
  bootstrap: () => request<BootstrapResponse>("/bootstrap"),
};
