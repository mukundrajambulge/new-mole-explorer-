import type { CommandResult } from "@molecular/contracts";
import { apiClient } from "../lib/apiClient";

export type MoleExplorerCommandSubmitter = (rawCommand: string) => Promise<CommandResult>;

/** Typed SDK facade. Each method submits compatibility text only at the command boundary;
 * the API compiler produces the canonical command and the dispatcher remains the sole executor. */
export const createMoleExplorerSession = (submit: MoleExplorerCommandSubmitter = (rawCommand) => apiClient.executeCommand({ rawCommand, surface: "SDK" })) => ({
  selection: {
    select: (query: string, operation: "replace" | "add" | "subtract" | "intersect" = "replace") => submit(`select ${operation}, ${query}`),
  },
  representation: {
    show: (representation: string, query = "all") => submit(`show ${representation}, ${query}`),
    hide: (representation: string, query = "all") => submit(`hide ${representation}, ${query}`),
  },
  color: {
    set: (color: string, query = "all") => submit(`color ${color}, ${query}`),
  },
  measure: {
    distance: (first: string, second: string) => submit(`distance ${first}, ${second}`),
  },
  edit: {
    addHydrogens: (query = "all") => submit(`h_add ${query}`),
  },
  alignment: {
    align: (mobile: string, target: string) => submit(`align ${mobile}, ${target}`),
  },
  scene: {
    store: (name: string) => submit(`scene_store ${name}`),
  },
});

export type MoleExplorerSession = ReturnType<typeof createMoleExplorerSession>;
