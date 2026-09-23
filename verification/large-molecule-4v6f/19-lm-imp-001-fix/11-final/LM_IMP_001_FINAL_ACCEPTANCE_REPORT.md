# LM-IMP-001 final acceptance report

Status: **CLOSED — PASS**

Branch: `fix/lm-imp-001-canonical-large-ingestion`
Starting HEAD: `1b44780c214e83c4d864bb94ecd49132d59b09c3`
Source: official 4V6F mmCIF, SHA256 `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`

The large molecule now completes canonical ingestion through `compact-canonical-v1`, renders actual 4V6F geometry, and remains interactable. The fixed result contains 307,345 atoms, 318,270 bonds, 26,941 residues, 5,467 asym-id chains, and one state. Classification is 301,988 polymer atoms, zero ligands, six waters, 5,351 ions, and 174 polymer HETATM rows retained.

The browser acceptance run reached `ready` in 46,565 ms with one canvas, one renderer model, 307,345 renderer atoms, full progressive stage, and no application/page errors. The selection/camera smoke picked one atom with a visible selection indicator and verified reset, zoom, fit, and center while retaining ready state and canonical counts.

All 215 unit tests passed; typecheck, production build, and lint passed. Bounded 30/60/120-second profiles completed without deadline kills. The compact HTTP response is 60,012,164 bytes versus 221,551,668 bytes for the prior object-shaped response.

Evidence is organized in this campaign root, including the [final interaction screenshot](../08-selection-smoke/LM_IMP_001_SELECTION_CAMERA_SMOKE_4V6F.png).
