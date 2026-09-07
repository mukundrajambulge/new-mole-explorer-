import { expect, test } from "@playwright/test";

const api = "http://localhost:8100";

test("R10 registry exposes versioned canonical command metadata", async ({ request }) => {
  const response = await request.get(`${api}/api/v1/commands/registry`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { summary: { registryVersion: string; schemaVersion: string }; commands: Array<{ canonicalName: string; handlerKey: string }> };
  expect(body.summary.registryVersion).toBe("r10-command-registry.v1");
  expect(body.summary.schemaVersion).toBe("r10-command-schema.v1");
  expect(body.commands.find((entry) => entry.canonicalName === "set")?.handlerKey).toBe("setting.set");
});

test("R10 typed REST endpoint rejects raw host-language text", async ({ request }) => {
  const response = await request.post(`${api}/api/v1/commands/execute`, { data: { rawCommand: "python print(1)" } });
  expect(response.status()).toBe(422);
  const body = await response.json() as { diagnostics: Array<{ code: string }> };
  expect(body.diagnostics[0]?.code).toBe("INVALID_ARGUMENT");
});

test("R10 async command reports the exact durable job lifecycle", async ({ request }) => {
  const response = await request.post(`${api}/api/commands`, { data: { rawCommand: "set orthoscopic, on", requestedMode: "ASYNC" } });
  expect(response.ok()).toBeTruthy();
  const pending = await response.json() as { job: { jobId: string; state: string } };
  expect(pending.job.state).toBe("Queued");
  let state = "Queued";
  for (let attempt = 0; attempt < 20 && state === "Queued"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const jobResponse = await request.get(`${api}/api/commands/jobs/${encodeURIComponent(pending.job.jobId)}`);
    state = (await jobResponse.json() as { state: string }).state;
  }
  expect(state).toBe("Completed");
});

test("R10 unsafe console text is rejected before dispatch", async ({ request }) => {
  const response = await request.post(`${api}/api/commands`, { data: { rawCommand: "system whoami" } });
  expect(response.status()).toBe(422);
  const body = await response.json() as { diagnostics: Array<{ code: string }> };
  expect(body.diagnostics[0]?.code).toBe("UNSAFE_COMMAND_REJECTED");
});
