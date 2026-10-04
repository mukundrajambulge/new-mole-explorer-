# Preparation replay report

**Status: NOT RUN.** No fixture preparation was run, so no replay or digest-equality result exists. Synthetic safe-control repeats passed, but are not fixture replay evidence.

AUTH04 lists deterministic replay as a mandatory execution precondition. Integrated task §25 directs running preparation again from the same byte-exact sources and profile and requires identical canonical outputs/digests. This report records that requirement without claiming a replay result or interpreting a run that did not occur.

The Linux continuation resolved the import restriction and passed safe synthetic controls. Fixture preparation remains unconsumed because hash-gated source preflight found unresolved A/B coordinate states at ASN68, ASP72, and ARG76 that are not covered by the frozen profile. No initial fixture preparation started, so deterministic fixture replay could not be performed.

The hand-built ethane and aromatic benzene controls each ran twice in separate Linux processes. Their within-control signatures matched. These synthetic results do not establish fixture determinism and are recorded under `runtime_logs/linux/`.
