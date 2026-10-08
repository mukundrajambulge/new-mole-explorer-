# Docking wizard (preview)

Open the Docking workspace. The wizard under the viewer has five steps. Every screen carries the banner "Preview: not scientifically qualified". When the backend is the mock job server, a MOCK label is also shown and all numbers are fake test data.

1. Inputs. The receptor is the polymer part of the loaded structure. Pick the ligand from the ligand components of the structure, or upload a separate ligand file.
2. Prepare. Set pH, protonation and waters, press Prepare, read the preparation report (decisions, warnings, rotatable bonds), tick any required acknowledgements, then press Confirm.
3. Box. Edit the six box numbers, or press "Box around ligand". Edges must be 1 to 40 Angstrom.
4. Run. Set exhaustiveness (1-64), number of poses (1-20) and seed. A progress bar shows the job; Cancel stops it.
5. Results. The table lists rank, Vina score, ME score and RMSD to the best pose. RMSD is computed in the browser from the pose files; "n/a" means the coordinates were not available. Click a row to overlay the pose; the H-bond option draws N/O pairs within 3.5 Angstrom (distance only). Download SDF, PDBQT or JSON.

Errors from the docking service are shown as received. Loading a different structure discards in-flight work and old replies. Leaving the workspace aborts open requests.

Configuration: VITE_DOCKING_API_BASE_URL (default /api) and VITE_DOCKING_MOCK=1 when pointing at the mock server (apps/api/src/jobs/mockServer.ts).

The wizard is the only Inputs UI (it sits in the left column of the Docking workspace). A ligand picked from the structure gets its own component id, different from the receptor id. The pose overlay uses the shared viewer; with the mock server the pose is a fake ring placed at the box center, labelled MOCK. Run the mock with `node --import tsx apps/api/src/jobs/mockServer.ts` (port 8101).
