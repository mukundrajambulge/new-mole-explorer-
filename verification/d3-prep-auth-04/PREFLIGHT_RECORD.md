# AUTH04 repository and evidence preflight

## Repository

- Workspace: C:/Users/mukun/.codex/worktrees/d3-prep-auth-04-3dmx-bnz/molecular-workstation
- Branch: research/d3-prep-auth-04-3dmx-bnz
- Required parent: be16bd1149e7a2e1285916846265ffbcbee8c341
- Pre-write HEAD: 2fa8660cdd8accd1a9acedd0018cea1fdec0b9e8 (`docs: add D3 prep AUTH04 decision package`), a direct child of the required parent above.
- Pre-write status: clean.
- The existing isolated AUTH04 managed worktree and branch were continued; the setup commit above introduced the initial AUTH04 lane on top of the exact predecessor. The independent DEC04 worktree remained at the exact required parent and was verified separately. No predecessor files were edited.
- Write scope: verification/d3-prep-auth-04/** only.

## Predecessor verification

- Predecessor branch: research/d3-prep-dec-04-3dmx-bnz.
- Predecessor worktree HEAD matched be16bd1149e7a2e1285916846265ffbcbee8c341.
- Predecessor worktree status was clean before this task.
- The complete DEC04 evidence lane was read directly from that worktree.
- The predecessor SHA256SUMS.txt was checked against local file bytes: 19/19 entries match.
- The six-entry SOURCE_MANIFEST.csv was checked against local source bytes: 6/6 entries match.
- Predecessor branch and cleanliness checks passed: exact expected branch, exact commit, zero porcelain status entries.

During final review, the same inherited DEC04 paths were also checked as materialized in the AUTH04 worktree. That Windows checkout uses `core.autocrlf=true`: 14/19 inherited DEC04 SHA256SUMS entries are not byte-identical there, and the source manifest's 3DMX.cif and BNZ.cif inputs are 2/6 entries whose AUTH04-worktree bytes fail their expected SHA-256 values after LF-to-CRLF checkout conversion. This does not indicate a change to the clean DEC04 worktree: its exact `be16bd1149e7a2e1285916846265ffbcbee8c341` checkout still passes 19/19 and 6/6. No DEC04 files were modified. Any execution must read the exact source bytes from that predecessor checkout (or use independently hash-verified byte-identical copies) and verify every digest before parsing; it must stop on any mismatch and must not silently normalize the AUTH04-worktree files.

## Authority/source preflight at original AUTH04 preparation time

Current source records were read from Google Drive on 2026-10-03. Current revisions inspected:

- Mole Explorer Global Master Plan and Source of Truth — AHj4eMTLgGmcNEpnYt2SFQqCOfly8JuEW5sySIWK9k41CkPZY3nOj_dnZyLD6tY0geVQ-qRYsquDj9xitAD-RWTsj4CtJSPRnWovhoVMlMw.
- Mole Explorer Execution Roadmap and Master Plan — ANLCKQl2s3TyUYW5qYe_9qihkOwWtCeF0OLunNFacRrnaFDzv_mD1Y8bU6osvkbh_qqeIBoMFpaqGjWvnPC486UlQH8-6QuwA1pFIpvyZ_M.
- D3-GRID-DEC-02 — Architecture B Owner Approval — AHj4eMTTkAi_6So5HQaHKzGypf1Ei7ZgO5P_X5O0zkqKmAp3aHvNIID1RcXMue8xfesj28-CekMWja3bNO3VqNqeaT0yddOFqkRBAp2ezIU.
- D3-DEC-02 — Owner Decision Registration — AHj4eMThigY_2wxXcQLaPfH28OIIrjf_DK84W7P8Cx0U-OnAU8PeZaIporbq7R4RUBpg7KizCnLV3K4_fJ4ineljyEVYzowkl33gGjytwvw.
- PHD-V2-03 — Receptor Identity, Biological State & Receptor Preparation — AHj4eMTZx1o61K47__QoTdGSaP6ichYRDIWHv4X6WwZmJvResMfp805f5aFBYUvLcHgcvpISPWaQLHPtsst4RLoGhIRl3TLEg3YaiYbOYnQ.
- PHD-V2-15 — Integrated Docking Scientific Synthesis — AHj4eMSABi2EFQ66czIYKE3ePvaVAPq065hT6Qm2snViGr1F0AV9ZZ1jCtPHVNGdYSYfEKkvmEyzelcgMDHhGOLHCMYDHdCUqYg6B8QJc6U.
- PHD-V2 normalized requirements — ANLCKQmtImJkL0jzAX0tEWe60IujhfqJ6tupR1gdajVLTmssVLnYDSrAZ28xxii8x87ycUPyxxepBsJumZdT8SxePEQ6Csd8dHZdQFF4gj8.
- PHD-V2 final acceptance specification — ANLCKQnGgNT040dvQhVTt7hJkBCuHUdaXDz34CcdPGQtQljd3u63CX3VqKjZNvoB7CAyInv7bhXmr9GNUidGWSisakQkoE2p5tYICygafzc.

At the time of this original pre-write preflight, searches for D3-PREP-AUTH-04 and 3DMX BNZ preparation owner approval returned no matching record. The current Architecture B approval explicitly says it does not approve a preparation profile. The later explicit owner authorization is documented separately below; it was not part of this original preflight snapshot.

## Toolchain preflight

Official primary release/API/source pages and version-specific package hashes are in HYDROGEN_TOOLCHAIN_CANDIDATES.md, PINNED_TOOLCHAIN_PROPOSAL.md and TOOLCHAIN_API_VERIFICATION.md. The Python 3.13.16 official installer was acquired and its SHA-256 matched the published release checksum. The RDKit and dependency wheels were not acquired or installed. No chemistry package import, fixture parse for preparation, AddHs call, or molecular output occurred.

The observed host processor at preflight is 12th Gen Intel(R) Core(TM) i5-12500H, 12 cores/16 logical processors. The OS API reports Windows 10 Pro, build 26200, x64. The eventual execution task must recapture these facts; they identify this preflight host only.

The lane-local .gitattributes pins Markdown/text artifact line endings to LF so byte-level checksums remain stable on Windows checkout. SHA256SUMS.txt covers the report/evidence files and CHANGED_PATHS.txt; it excludes itself to avoid recursive self-hashing and excludes .gitattributes because that file only controls checkout representation.

## Post-owner-decision closure preflight — 2026-10-04

- The user instruction `MOLE EXPLORER — D3-CLOSURE-EXEC-01` explicitly records owner YES for AUTH04-01, AUTH04-02 and AUTH04-03 using the exact proposed choices and fixture-only scope. The source file SHA-256 is recorded in `OWNER_AUTHORIZATION_RECORD.md`.
- The current Roadmap was reread from Drive on 2026-10-04 (revision `AHj4eMRHkctrstRa_A9CeOD3tpDUQHvVTEXBMiAq5vHT-UTCavbbWyMlFnCrhsD0tpdHfCjZ4hPM3nxKoAa7lWBBuUAePc-TWbfKI3ENcxs`). It requires code review and an independent evidence review for gate closure. No reviewer or sign-off was available; `REVIEW_REQUIREMENT_STATUS.md` records this unresolved gate-exit condition.
- RDKit 2026.03.6 API documentation and pinned release wrapper/source were checked. The Python call uses explicit bool flags, and the internal `skipQueries` default is false. The executable instruction is in `TOOLCHAIN_API_VERIFICATION.md` and `PINNED_TOOLCHAIN_PROPOSAL.md`.
- The official Python installer hash matched. A per-user isolated installation attempt rolled back with Windows Installer error `0x80070003` while opening the local `core.msi` cache path. No CPython 3.13.16 runtime or package wheel was installed. This task performed no import, graph construction, AddHs operation, 3DMX/BNZ preparation, scoring, or grid construction.
- Because the required independent evidence review is absent, AUTH04 remains HOLD, D3-PREP-EXEC-04 is not authorized, and no execution prompt is generated.
