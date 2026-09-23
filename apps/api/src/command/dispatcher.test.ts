import { describe, expect, it } from "vitest";
import { CommandDispatcher } from "./dispatcher.js";
import { compileSafeCommand } from "./compiler.js";

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
    const pending = dispatcher.dispatch({ rawCommand: "set orthoscopic, on", requestedMode: "ASYNC" });
    expect(pending.job?.state).toBe("Queued");
    await Promise.resolve();
    const job = dispatcher.getJob(pending.job!.jobId);
    expect(job?.state).toBe("Completed");
  });

  it("enforces expected revisions before a handler can mutate state", () => {
    const dispatcher = new CommandDispatcher({ revisions: { session: 4 } });
    const command = compileSafeCommand("set orthoscopic, on", { expectedRevisions: { session: 3 } }).command!;
    const result = dispatcher.dispatch({ command });
    expect(result.status).toBe("FAILED");
    expect(result.diagnostics[0]?.code).toBe("REVISION_CONFLICT");
  });

  it("does not duplicate a queued idempotent job", async () => {
    const dispatcher = new CommandDispatcher();
    const first = dispatcher.dispatch({ rawCommand: "set orthoscopic, on", requestedMode: "ASYNC", idempotencyKey: "queued-once" });
    const second = dispatcher.dispatch({ rawCommand: "set orthoscopic, on", requestedMode: "ASYNC", idempotencyKey: "queued-once" });
    expect(second.job?.jobId).toBe(first.job?.jobId);
    await Promise.resolve();
  });

  it("compiles and dispatches only a fully valid bounded batch", () => {
    const dispatcher = new CommandDispatcher();
    const batch = dispatcher.dispatchBatch({ rawCommand: "set orthoscopic, on; set background_color, red", idempotencyKey: "batch-once" });
    expect(batch.status).toBe("SUCCEEDED");
    expect(dispatcher.history.list()).toHaveLength(2);
    expect(dispatcher.dispatchBatch({ rawCommand: "set orthoscopic, on; set background_color, red", idempotencyKey: "batch-once" }).status).toBe("SUCCEEDED");
    expect(dispatcher.history.list()).toHaveLength(2);
    const rejected = dispatcher.dispatchBatch({ rawCommand: "set orthoscopic, on; python print(1)" });
    expect(rejected.status).toBe("FAILED");
    expect(rejected.diagnostics[0]?.code).toBe("UNSAFE_COMMAND_REJECTED");
  });

  it("keeps the exact durable job states and creates a new retry attempt", async () => {
    const dispatcher = new CommandDispatcher();
    const pending = dispatcher.dispatch({ rawCommand: "cealign all, all", requestedMode: "ASYNC" });
    expect(pending.job?.state).toBe("Queued");
    await Promise.resolve();
    const failed = dispatcher.getJob(pending.job!.jobId)!;
    expect(failed.state).toBe("Failed");
    const retried = dispatcher.retry(failed.jobId)!;
    expect(retried.attempt).toBe(2);
    expect(retried.executionId).not.toBe(failed.executionId);
    expect(retried.previousAttemptId).toBe(failed.executionId);
    await Promise.resolve();
    expect(dispatcher.getJob(retried.jobId)?.state).toBe("Failed");
    expect(dispatcher.history.list().map((record) => record.attempt).sort()).toEqual([1, 2]);
    expect(dispatcher.listJobs().every((job) => ["Created", "Queued", "Running", "Completed", "Failed", "Cancelled"].includes(job.state))).toBe(true);
  });
});
