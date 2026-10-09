import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DOCK_SCORE_LABEL } from "@molecular/contracts";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const FORBIDDEN = [/kcal\/mol \(Vina estimate\)/i, /binding affinity/i, /affinity score/i, /binding free energy(?!\W*")/i, /ΔG/, /best binder/i];

describe("honest score labels (no affinity/energy claims)", () => {
  it("contract label states empirical, lower-is-better, not a free energy", () => {
    expect(DOCK_SCORE_LABEL.scoreName).toBe("Vina score");
    expect(DOCK_SCORE_LABEL.scoreDirection).toBe("lower is better");
    expect(DOCK_SCORE_LABEL.unitsNote).toContain("not a binding free energy");
  });
  it("wizard shows the honest column header and tooltip", () => {
    const src = read("./DockingWizard.tsx");
    expect(src).toContain("Vina score (empirical, lower is better)");
    expect(src).toContain('title="not a binding free energy"');
  });
  it("no UI or run output text presents a score as an affinity or energy", () => {
    for (const rel of ["./DockingWizard.tsx", "./DockingWorkflowPanel.tsx", "./DockingWorkspace.tsx", "./DockingBottomPanel.tsx", "./wizardLogic.ts", "../../../../tools/mole-dock/run.mjs"]) {
      const src = read(rel);
      for (const re of FORBIDDEN) {
        const m = src.match(new RegExp(re.source, re.flags + "g")) ?? [];
        // the only allowed occurrence is the explicit negation "not a binding free energy"
        const bad = m.filter((x) => !/free energy/i.test(x));
        expect(bad, `${rel} ${re}`).toEqual([]);
      }
      expect(src).not.toContain("kcal/mol (Vina estimate)");
    }
  });
});
