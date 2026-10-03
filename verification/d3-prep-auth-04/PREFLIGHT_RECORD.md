# AUTH04 repository and evidence preflight

## Repository

- Workspace: C:/Users/mukun/.codex/worktrees/d3-prep-auth-04-3dmx-bnz/molecular-workstation
- Branch: research/d3-prep-auth-04-3dmx-bnz
- Required parent: be16bd1149e7a2e1285916846265ffbcbee8c341
- Pre-write HEAD: verified at the exact required parent.
- Pre-write status: clean.
- New worktree was created from the exact predecessor SHA and attached to this task. No predecessor files were edited.
- Write scope: verification/d3-prep-auth-04/** only.

## Predecessor verification

- Predecessor branch: research/d3-prep-dec-04-3dmx-bnz.
- Predecessor worktree HEAD matched be16bd1149e7a2e1285916846265ffbcbee8c341.
- Predecessor worktree status was clean before this task.
- The complete DEC04 evidence lane was read directly from that worktree.
- The predecessor SHA256SUMS.txt was checked against local file bytes: 19/19 entries match.
- The six-entry SOURCE_MANIFEST.csv was checked against local source bytes: 6/6 entries match.
- Predecessor branch and cleanliness checks passed: exact expected branch, exact commit, zero porcelain status entries.

## Authority/source preflight

Current source records were read from Google Drive on 2026-10-03. Current revisions inspected:

- Mole Explorer Global Master Plan and Source of Truth — AHj4eMTLgGmcNEpnYt2SFQqCOfly8JuEW5sySIWK9k41CkPZY3nOj_dnZyLD6tY0geVQ-qRYsquDj9xitAD-RWTsj4CtJSPRnWovhoVMlMw.
- Mole Explorer Execution Roadmap and Master Plan — ANLCKQl2s3TyUYW5qYe_9qihkOwWtCeF0OLunNFacRrnaFDzv_mD1Y8bU6osvkbh_qqeIBoMFpaqGjWvnPC486UlQH8-6QuwA1pFIpvyZ_M.
- D3-GRID-DEC-02 — Architecture B Owner Approval — AHj4eMTTkAi_6So5HQaHKzGypf1Ei7ZgO5P_X5O0zkqKmAp3aHvNIID1RcXMue8xfesj28-CekMWja3bNO3VqNqeaT0yddOFqkRBAp2ezIU.
- D3-DEC-02 — Owner Decision Registration — AHj4eMThigY_2wxXcQLaPfH28OIIrjf_DK84W7P8Cx0U-OnAU8PeZaIporbq7R4RUBpg7KizCnLV3K4_fJ4ineljyEVYzowkl33gGjytwvw.
- PHD-V2-03 — Receptor Identity, Biological State & Receptor Preparation — AHj4eMTZx1o61K47__QoTdGSaP6ichYRDIWHv4X6WwZmJvResMfp805f5aFBYUvLcHgcvpISPWaQLHPtsst4RLoGhIRl3TLEg3YaiYbOYnQ.
- PHD-V2-15 — Integrated Docking Scientific Synthesis — AHj4eMSABi2EFQ66czIYKE3ePvaVAPq065hT6Qm2snViGr1F0AV9ZZ1jCtPHVNGdYSYfEKkvmEyzelcgMDHhGOLHCMYDHdCUqYg6B8QJc6U.
- PHD-V2 normalized requirements — ANLCKQmtImJkL0jzAX0tEWe60IujhfqJ6tupR1gdajVLTmssVLnYDSrAZ28xxii8x87ycUPyxxepBsJumZdT8SxePEQ6Csd8dHZdQFF4gj8.
- PHD-V2 final acceptance specification — ANLCKQnGgNT040dvQhVTt7hJkBCuHUdaXDz34CcdPGQtQljd3u63CX3VqKjZNvoB7CAyInv7bhXmr9GNUidGWSisakQkoE2p5tYICygafzc.

Searches for D3-PREP-AUTH-04 and 3DMX BNZ preparation owner approval returned no matching owner-approval record. The current Architecture B approval explicitly says it does not approve a preparation profile. No individual owner approval is claimed.

## Toolchain preflight

Official primary release/API/source pages and version-specific package hashes are in HYDROGEN_TOOLCHAIN_CANDIDATES.md and PINNED_TOOLCHAIN_PROPOSAL.md. Exact packages have not been downloaded or installed for this authorization lane. No chemistry package import, fixture parse for preparation, AddHs call, or molecular output occurred.

The observed host processor at preflight is 12th Gen Intel(R) Core(TM) i5-12500H, 12 cores/16 logical processors. The OS API reports Windows 10 Pro, build 26200, x64. The eventual execution task must recapture these facts; they identify this preflight host only.

The lane-local .gitattributes pins Markdown/text artifact line endings to LF so byte-level checksums remain stable on Windows checkout. SHA256SUMS.txt covers the report/evidence files and CHANGED_PATHS.txt; it excludes itself to avoid recursive self-hashing and excludes .gitattributes because that file only controls checkout representation.
