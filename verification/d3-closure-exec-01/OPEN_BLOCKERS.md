# Open blockers

## B1 — 3DMX alternate coordinate states exceed the frozen profile

Hash-gated preflight of the byte-exact 3DMX source found A/B polymer alternate groups at ASN68 (five atoms; A .70/B .30), ASP72 (five atoms; A .80/B .20), and ARG76 (eight atoms; A .60/B .40). The owner-approved profile explicitly resolves only MET106 and GLU108. The continuation authorizes execution-platform relocation only and prohibits changing the alternate policy. Automatically extending maximum-occupancy A selection or omitting/retaining the unresolved atoms would alter the approved molecular coordinate state. The preflight therefore stopped before accepting a receptor graph or passing a fixture molecule to RDKit.

The current owner authorization is insufficient to choose these three states. The exact unresolved choice was submitted to the owner. Until answered, no fixture chemistry or any dependent seal/scoring/replay is authorized by the existing profile. See `SOURCE_PROFILE_MISMATCH.md` and `runtime_logs/linux/source-altloc-preflight.json`.

## Completed runtime issue

The historical Windows Code Integrity block remains preserved, but it is no longer the active runtime blocker. Under the owner's bounded relocation authorization, the exact CPython 3.13.16 / RDKit 2026.03.6 stack imports on existing WSL2 Ubuntu x86-64, and safe synthetic AddHs controls passed twice with matching signatures. No host policy was modified. See `LINUX_RUNTIME_RECORD.md` and `PLATFORM_EQUIVALENCE_REVIEW.md`.

## Work not started because B1 remains unresolved

No fixture `Chem.AddHs` call, preparation run config/seal, receptor/BNZ prepared state, heavy-atom invariant measurement, fixture hydrogen provenance, deterministic fixture replay, SearchRegion, full-pose direct/grid cohort/statistics, or fixture-specific resource check was produced. The executable full-pose runner is now available and passed only a marked synthetic smoke control; it is not a substitute for the missing sealed states. No scientific scoring discrepancy or regression was measured; fixture evaluation was not reached.
