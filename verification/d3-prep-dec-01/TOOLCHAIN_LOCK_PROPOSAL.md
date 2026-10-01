# Toolchain lock proposal

## Status

**No preparation toolchain is selected or authorized.** The following are researched candidate artifacts from the D3-RA-01 synthetic-only tool check, not a reproducible environment lock and not evidence of scientific preparation:

| Candidate | Reported version/artifact | Recorded artifact SHA-256 | Status |
|---|---|---|---|
| PDB2PQR | 3.7.1 wheel | 15f7422a41ea4c789e564e2ef00ac10b8f020b589b650f6225e627a5901305ea | Candidate evidence only |
| PROPKA | 3.5.1 artifact | 2df2d81adc9205113a0e6f9d96b06b46e29716bc3a712075dd396e0eefdfc3 | Candidate evidence only |
| RDKit | 2026.03.6 CPython 3.12 manylinux x86_64 artifact | 9f97b58f1962df73bdacf44347bfa013f4fcb9896e049f98af2183e70e7aab46 | Candidate evidence only |

The hashes identify those particular artifacts reported in D3-RA-01; they do not lock transitive dependencies, operating system, runtime, command-line behavior, or a complete container. Synthetic fixtures only were used in that prior tool check. No candidate tools were invoked in this lane.

## Minimum future lock evidence

A future owner-approved proposal must pin:
- immutable OCI image digest and platform/architecture;
- runtime, dependency lock and every wheel/package digest;
- exact executable versions and command invocations;
- configuration/profile identifiers, versions and content digests;
- input/output encodings and deterministic settings;
- treatment of atom naming, hydrogens, termini, components, and any optimization;
- reproducibility check on the exact approved input and a clean environment;
- scientific reviewer approval of the method and its output contract.

PDB2PQR's documented candidate defaults include atom debumping and hydrogen optimization; its no-optimization mode still permits water-only optimization. That behavior requires explicit control and heavy-atom immutability evidence before any future use. No defaults are accepted by this decision package.

DEC-10 is pending. Tool availability or an artifact hash alone does not authorize preparation.