# MOLEXPLORER 4V6F Acceptance Baseline

- Local repository: `C:\Users\mukun\Desktop\molecular-workstation`
- Git root: `C:\Users\mukun\Desktop\molecular-workstation`
- Remote: `new-origin` → `https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Campaign branch: `qa/final-large-molecule-4v6f-acceptance`
- Base SHA before the scoped import fix: `a9c8667304cc07158fecbd935f3eb314d515c55d`
- Current HEAD after the scoped import fixes: `e0851f91706dff2cf015447cd5a4ecf2fe31d540`
- Large-file fix commit: `5248103` (`fix: allow large structure ingestion beyond 25 MiB`)
- Canonical-ingestion bounding commit: `e0851f9` (`fix: bound large mmCIF canonical ingestion`)
- Git status at baseline capture: clean tracked state; pre-existing untracked `outputs/` preserved
- Previous selection-QA ancestry: branch `qa/exhaustive-selection-a-bf`, commit `a9c8667`
- Previous selection-QA report: 523/523 selection executions; 536 screenshots; 303 PASS, 185 EMPTY_VALID, 5 IMPLEMENTED_WITH_LIMITATION, 30 INVALID_EXPECTED
- Node: v24.14.1
- npm: 11.11.0
- OS: Microsoft Windows 11 Pro
- Browser/test runtime: Playwright 1.62.1 (`@playwright/test`); browser executable resolution pending application boot

## Import policy

The former 25 MiB boundary is now a warning threshold only (`25 * 1024 * 1024`).
The active buffered ingestion safety ceiling is 512 MiB (`512 * 1024 * 1024`).
Multipart requests allow the ceiling plus 1,000,000 bytes of envelope overhead.
The former error `Structure files must be 25 MB or smaller.` is not used by the
active import path.

## Regression status

`POST_FIX_IMPORT_REGRESSION = PASS` for the policy boundary checks at 24 MiB,
25 MiB, 25 MiB + 1 byte, 50 MiB, and 100 MiB. The 512 MiB + 1 byte safety
ceiling remains rejected with the new 512 MiB error. API ingestion tests and
API typecheck passed after the fix.
