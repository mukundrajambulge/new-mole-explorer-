# D3-PREP-EXEC-04 readiness matrix after owner decision closure

| Requirement | AUTH04 evidence/status | Preparation authorization |
|---|---|---|
| Fixture/source identity | 3DMX/BNZ retained; exact DEC04 source hashes remain authoritative. AUTH04 checkout CIF bytes are CRLF-converted and fail those hashes; use verified byte-exact predecessor inputs. | PASS only after execution hash recheck |
| AUTH04-01 bootstrap exception | Explicit owner YES; exact single-use scope in `OWNER_AUTHORIZATION_RECORD.md` | PASS |
| AUTH04-02 state/context | Explicit owner YES; pH 6.9 proxy; full state map; GLU128− and corrected 51+2 inventory | PASS, subject to execution inventory check |
| AUTH04-03 profile/components/toolchain | Explicit owner YES to profile v1.0.0 and pinned RDKit stack; Python wrapper API syntax corrected without semantic change | PASS as a frozen proposal |
| Heavy-atom invariant | Exact in-memory bitwise identity and zero unauthorized changes required; not run in this authorization task | Mandatory execution precondition |
| Hydrogen provenance | Per-H parent AtomUID, operation, tool/build, profile, inputs, coordinate bits and run provenance contract | Mandatory execution precondition |
| Runtime/wheel availability | Installer hash matched official release; this host's isolated installer attempt rolled back with 0x80070003; exact runtime/wheels not installed here | Must be verified before any molecular operation |
| Deterministic replay | Exact stack/config is pinned; no fixture AddHs call or replay performed in this authorization task | Mandatory execution precondition |
| Qualified independent chemist review | Recommended, not required before the bounded preparation call under the reviewed PHD-V2 preparation rules | Not a blocker to the tool call by itself |
| Roadmap independent evidence review | Required for gate closure under current Roadmap; no reviewer/sign-off evidence exists | **BLOCKED — required contract condition unsatisfied** |
| Prepared-state payload/digest | None created; no molecular operation occurred | Correctly absent |
| D3 / D4 / capability registry | D3 remains HOLD; D4 BLOCKED; `DOCKING.RUN` UNAVAILABLE | Unchanged |

## Gate result

Owner choices are explicit and the exact profile/toolchain proposal is frozen. The required independent evidence review for gate closure is missing, so D3-PREP-EXEC-04 is **NOT AUTHORIZED** and no execution prompt is generated. This classification does not revoke or alter the recorded owner YES decisions.
