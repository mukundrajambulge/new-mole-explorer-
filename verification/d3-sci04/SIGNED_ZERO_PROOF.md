# D3-SCI-04 Signed-Zero Proof

The approved logical semantics preserve IEEE-754 binary64 signs where canonical `F64Bits` requires bit-exact identity.

- An omitted raw HYD or HB channel is materialized as `+0.0`, bits `0000000000000000`.
- The unchanged direct scorer applies ordinary negative HYD/HB weights, producing `-0.0`, bits `8000000000000000` in the exercised cases.
- The native proof checks both term families against the D3-TOR-01 scorer.
- The canonical CBOR fixture round-trips raw `+0.0` and weighted `-0.0` without normalizing either; their digest representations remain distinct.

Evidence: [direct-scorer-proof.json](evidence/direct-scorer-proof.json), [serialization-proof.json](evidence/serialization-proof.json), [sparse_zero_proof.cpp](sparse_zero_proof.cpp), and [sparse-contract.test.ts](sparse-contract.test.ts). These are bounded research fixtures; no production grid or serializer was implemented.
