# D3 security and dependency assessment

Candidate code commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3

A fresh npm audit reported five vulnerable package entries in development/test dependencies: three moderate, one high, and one critical. The affected package entries are @vitest/mocker, esbuild, vite, vite-node, and vitest; several entries aggregate multiple advisories, so the list below contains six advisory links. npm audit --omit=dev reported zero production dependency findings. The audit state was already present before D3 source changes; package.json and lockfile were not changed, and no dependency update was attempted.

Relevant advisories and exposure notes:

- Vitest UI path traversal, critical: https://github.com/advisories/GHSA-5xrq-8626-4rwp. The project test command uses vitest run; the vulnerable UI server is not used by the recorded regression commands.
- Vitest mocker, moderate: https://github.com/advisories/GHSA-82fw-gwwq-j7x9. The exposure concerns a reachable Vite development server under affected conditions.
- esbuild development server CORS, moderate: https://github.com/advisories/GHSA-67mh-4wv8-2f99. The exposure concerns the development server.
- Vite Windows server.fs.deny bypass, high: https://github.com/advisories/GHSA-fx2h-pf6j-xcff. The advisory requires relevant server/network exposure conditions.
- Vite outside-project map file read, moderate: https://github.com/advisories/GHSA-4w7w-66w2-5vf9. The advisory requires an exposed development server.
- Vite/launch-editor Windows UNC path issue, moderate: https://github.com/advisories/GHSA-v6wh-96g9-6wx3. It concerns Windows editor-launch paths and NTLM hash exposure.

The package count is five; the listed advisories describe issues affecting packages in the audited dependency tree, including multiple advisories across Vite-related packages. These findings are not caused by D3 and do not arise in the production dependency audit. Keep development servers local and update the tooling through a separately reviewed dependency change. D3 did not add network-facing routes or executables.

