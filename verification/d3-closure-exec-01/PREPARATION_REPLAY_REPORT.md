# Preparation replay report

**Status: NOT RUN.** No fixture preparation was run, so no replay or digest-equality result exists.

AUTH04 lists deterministic replay as a mandatory execution precondition. Integrated task §25 directs running preparation again from the same byte-exact sources and profile and requires identical canonical outputs/digests. This report records that requirement without claiming a replay result or interpreting a run that did not occur.

The approved preparation remains unconsumed because Windows Code Integrity blocked import of the pinned RDKit native extension before any molecular operation. No initial preparation started, so a deterministic fixture replay could not be performed.

The permitted synthetic ethane control was not run because it uses the same RDKit extension blocked by Code Integrity. No synthetic result is represented as fixture determinism evidence.
