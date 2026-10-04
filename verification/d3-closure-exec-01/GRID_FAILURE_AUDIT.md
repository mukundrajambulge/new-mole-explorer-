# Grid failure audit

**Fixture-level status: PASS — six sealed-state poses completed without a grid failure.** The native field built from the sealed receptor and SearchRegion. All poses were reported IN_DOMAIN. The runner failed closed on OOD/interpolation errors and did not use direct-score fallback; none occurred. No fixture clamping, extrapolation, fallback, or OOD event was observed.

The native D3-GRID implementation test suite also passed under CMake/CTest. The preserved D3-GRID-01 report records the wider bounded OOD/fail-closed and interpolation-boundary fixtures. Fixture output and state/profile digests are in fullpose/results/FULLPOSE_NATIVE_RUN.log and FULLPOSE_POSE_MANIFEST.csv.
