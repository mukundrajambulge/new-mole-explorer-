import { describe, expect, it } from "vitest";
import { compileSafeCommand, compileSafeCommands } from "./compiler.js";

describe("R10 safe command parser security corpus", () => {
  const corpus = [
    "", "   ", "select (chain A and (resi 1-4))", "select name CA,", "set name = orthoscopic, value = on",
    "show sticks, (chain A or chain B)", "color 'red,blue', all", "get_view", "select [chain A", "select 'unterminated",
    "python print(1)", "javascript:alert(1)", "exec(\"x\")", "eval(\"x\")", "run echo bad", "system rm -rf /", "spawn whoami", "fork process", "powershell -Command whoami", "cmd.exe /c whoami", "bash -c whoami", "sh -c whoami", "select all && echo bad",
    "select all; python print(1)", "select all; get_view", "select ${process.env.SECRET}", "select `whoami`", "select $(whoami)", "color red, all > out", "select all || echo bad", "select all << secret",
    "select (((((((((((((((((((((((((((((((all)))))))))))))))))))))))))))))))",
  ];

  it("never throws and never evaluates corpus input", () => {
    for (const source of corpus) expect(() => compileSafeCommands(source)).not.toThrow();
  });

  it("rejects host-code and process escape attempts before dispatch", () => {
    for (const source of ["python print(1)", "javascript:alert(1)", "exec(\"x\")", "eval(\"x\")", "run echo bad", "system rm -rf /", "spawn whoami", "fork process", "powershell -Command whoami", "cmd.exe /c whoami", "bash -c whoami", "sh -c whoami", "select all && echo bad", "select all; python print(1)", "select ${process.env.SECRET}", "select `whoami`", "select $(whoami)"]) {
      expect(compileSafeCommand(source).diagnostics[0]?.code, source).toBe("UNSAFE_COMMAND_REJECTED");
    }
  });
});
