import { describe, expect, it } from "vitest";
import { CommandDispatcher } from "./dispatcher.js";

describe("R10 canonical dispatcher and provenance", () => {
  it("converges safe console/REST-shaped inputs and records redacted history", () => {
    const dispatcher = new CommandDispatcher();
    const first = dispatcher.dispatch({ rawCommand: "set orthoscopic, on", surface: "CONSOLE", idempotencyKey: "r10-idem-1" });
    expect(first.status).toBe("SUCCEEDED");
    expect(first.actionRecordId).toBeTruthy();
    const replayedByIdempotency = dispatcher.dispatch({ rawCommand: "set orthoscopic, off", surface: "REST", idempotencyKey: "r10-idem-1" });
    expect(replayedByIdempotency.executionId).toBe(first.executionId);
    expect(dispatcher.history.list()).toHaveLength(1);
  });

  it("fails closed before handler execution and supports async job states", async () => {
    const dispatcher = new CommandDispatcher();
    expect(dispatcher.dispatch({ rawCommand: "python print(1)" }).diagnostics[0]?.code).toBe("UNSAFE_COMMAND_REJECTED");
    const pending = dispatcher.dispatch({ rawCommand: "align all, all", requestedMode: "ASYNC" });
    expect(pending.job?.state).toBe("QUEUED");
    await Promise.resolve();
    const job = dispatcher.getJob(pending.job!.jobId);
    expect(job?.state).toBe("SUCCEEDED");
  });
});
