# Query gaps

The campaign generated 266 query cases across 87 maintained operators: 88 positive, 88 zero-result, and 90 malformed/invalid controls.

No executable PyMOL was available, so 92 cases remain **ORACLE_PENDING**. These are evidence gaps rather than failures of the Molexplorer selection engine. The pinned source oracle has 88 directly verified cases and 35 documented application-to-PyMOL equivalents in the comparison ledger.

## Required follow-up

- Install or provide the pinned PyMOL executable/runtime and rerun every positive and negative case.
- Capture return code, selected atom tuples, membership hash, and structured parse diagnostics.
- Promote a case only when the observed membership or documented alias mapping is exact.
- Keep malformed controls fail-closed; never treat parser errors as empty selections.

The full per-case ledger is in [QUERY_CORPUS.json](./QUERY_CORPUS.json) and [QUERY_ORACLE_COMPARISON.json](./QUERY_ORACLE_COMPARISON.json).
