# D3-FP-01 — Prepared-State / Full-Pose Fixture Closure

## Decision
D3-FP-01 HOLD — PREPARATION AUTHORIZATION REQUIRED

No qualifying D2-sealed PreparedReceptorState + PreparedLigandState pair is present in the authoritative repository or the current canonical Drive evidence reviewed for this lane. The ten inspected structure/ligand candidates are all NOT_PREPARED. The synthetic PDBQT tool fixtures are not scientific receptor–ligand fixtures and have insufficient provenance for admission.

This is a finite fixture-readiness HOLD. It does not change D3-GRID-01's bounded implementation PASS, accept Full D3, or authorize preparation. Full D3 remains HOLD; D4 remains BLOCKED; production docking and DOCKING.RUN remain UNAVAILABLE.

## Scope and result
The objective was to determine whether an already-existing, scientifically admissible full-pose validation cohort could be assembled from sealed states. The D2 fixture catalog and state contracts were inspected in the repository, as were D3 grid evidence and synthetic D3-IR-02 scorer-input fixtures. Current Drive evidence was reviewed for D2 closure, candidate audits, owner decisions, preparation research, and gate state.

No raw PDB/mmCIF, PDBQT, experimental complex, tool output, or catalog entry was reinterpreted as a D2-sealed state. No molecular preparation, state generation, state choice, docking, direct/grid comparison, or approximation experiment was performed.

The D2 contract records the state objects and their digests; the repository fixture catalog is a catalog of contract/test cases, not an experimental prepared-state dataset. See [D2 contract](../../packages/contracts/src/docking/d2.ts), [D2 fixture catalog](../docking/d2/03_FIXTURES/D2_FIXTURE_CATALOG.md), and [D2 implementation index](../docking/d2/02_IMPLEMENTATION_INDEX/D2_IMPLEMENTATION_INDEX.md). D3-GRID-01 reports bounded scoring-field implementation evidence and explicitly leaves full-pose fixture validation open: [D3 grid report](../d3-grid/D3_GRID_01_REPORT.md) and [D3 grid test report](../d3-grid/D3_GRID_01_TEST_REPORT.md).

## Candidate result
The current D3-VAL-01 inventory lists 181L/BNZ, 4W52/BNZ, 4W54/PYJ, 3ATL/BEN, and 1M17/AQ4 as NOT PREPARED / NOT ELIGIBLE. D3-RA-01 retains 181L/BNZ as a proposed primary and 3ATL/BEN as a conditional backup; neither is approved or prepared. Five additional prior-screen candidates have no established prepared states and lack the raw audit/provenance chain required here. Candidate-specific blockers and source links are in [eligibility matrix](FIXTURE_ELIGIBILITY_MATRIX.md) and [prepared-state inventory](PREPARED_STATE_INVENTORY.md).

The D3-SCI-03 manifest records zero admitted qualifying fixtures, with zero development and zero confirmatory fixtures: [D3-SCI-03 prepared-fixture manifest](https://drive.google.com/file/d/1khcukrEnWgHyBcZ6SOm7hwBb2Hj-W0M8/view). No eligible manifest is emitted because no state identifiers or scientific digests qualify.

## Current controlling scientific contract
The current scoring-field architecture is 16 XS types, 80 logical channels, and conditional 59 physical arrays, per the current D3-GRID-DEC-02 and reconciliation evidence: [approved architecture decision](https://docs.google.com/document/d/1eAGdTZhDEBmSYzbBy4zfeLADQDnjDeGA6Sg-XmhmJIg/edit?usp=drivesdk) and [current reconciliation](https://docs.google.com/document/d/1xcJnrNK6bni-_3GZfJEkHIKLHyOoZl9uCGGV6upCG6w/edit?usp=drivesdk). Historical 14/70 wording is superseded and is not used as the current contract.

Prepared receptor and ligand identity, chemical state, coordinate state, typing, preparation profiles, and provenance must be explicit and sealed under PHD-V2-03/04/06/10/15. SearchRegion is an exact, separately identified and hashed object under PHD-V2-05. The scoring and numeric profiles are also separate experiment inputs. The architecture approval does not approve a molecular-preparation profile, a candidate microstate, an approximation threshold, or Full D3.

## Smallest controlled next step
Obtain an owner decision to approve or reject the existing D3-VAL-01 proposed primary, 181L/BNZ, for a single development-fixture preparation package, then obtain independent structural-biology and computational-chemistry review of the exact construct, missingness, chemical states, component policy, ligand state, and proposed tool/settings lock. The minimum contents and stop conditions are specified in [preparation authorization minimum](PREPARATION_AUTHORIZATION_MINIMUM.md). No preparation begins until those decisions and approvals are recorded.

## Verification
The lane's evidence files, including this report, are listed in SHA256SUMS.txt. The final verification record confirms that all changed paths are under verification/d3-fp-01/**, git diff --check passes, no implementation files changed, every inspected candidate has a disposition, and no raw structure is labeled as prepared state. No tests were run because this evidence-only lane does not change code and the request forbids unrelated implementation work.

## Canonical sources
- [Global Master Plan and Source of Truth](https://docs.google.com/document/d/1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk/edit?usp=drivesdk)
- [Execution Roadmap and Master Plan](https://docs.google.com/document/d/1YDNaYI9xe9l3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU/edit?usp=drivesdk)
- [PHD-V2-03 — receptor identity and preparation](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit)
- [PHD-V2-04 — ligand representation and kinematics](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit)
- [PHD-V2-05 — binding site and SearchRegion](https://docs.google.com/document/d/1LEjVH3QmEWlzRzt_xAX-rZPVBTBP1tsIhOUyX-fPeck/edit)
- [PHD-V2-06 — supported chemistry, typing, and scoring](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit)
- [PHD-V2-10 — provenance, serialization, and hashing](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit)
- [PHD-V2-13 — numeric and resource boundaries](https://docs.google.com/document/d/1SZcS9UDGi-Ffa_WeOdWhrgdUaItHGxSRBzc271HF6OU/edit)
- [PHD-V2-15 — final synthesis and implementation authorization](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNVuTVuTZmiMicjHIVEfmpM/edit)
- [Normalized Docking Requirements](https://docs.google.com/document/d/1_M2RzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY/edit)
- [Final Docking Acceptance Specification](https://docs.google.com/document/d/1QjuDYapWNc2bRX4CUpa5w57iJP0evMc9SnSDqu8rFrg/edit)
- [D2 implementation closure](https://drive.google.com/file/d/10r1NVlJNQ_wjQEBaMLMUuObVbpm-DrX1/view)
- [D3-VAL-01 evidence folder](https://drive.google.com/drive/folders/1KVXKzwacjAjQSJri2VzP7byXpNt8F08H)
- [D3-RA-01 evidence folder](https://drive.google.com/drive/folders/18a3MguBMgcnYVfMTBdgHQ9XxetQHfinQ)
- [D3-GRID-01 report](https://drive.google.com/file/d/1G74q8U99ybepyG5Drbm8LyyWKn4MYrCD/view)
- [D3-GRID-01 test evidence](https://drive.google.com/file/d/15bDo6HKY7f56V_Fie6ecOyrIeqagOUxr/view)
