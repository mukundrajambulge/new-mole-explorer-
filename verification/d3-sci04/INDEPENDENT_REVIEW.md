# D3-SCI-04 Independent Read-Only Review

**Disposition:** No correctness defect was found in the proposed 80-logical/59-physical map or direct-scorer zero proof. Evidence supports the bounded research model, not final 59-array acceptance.

- The 16 XS types and term order match current PHD-V2-06 and the native scorer. The map omits 11 non-hydrophobic HYD channels and 10 HB channels for ligand types with neither donor nor acceptor role.
- The native proof covers all 256 receptor/ligand type pairs at five distances and verifies raw `+0.0` and weighted `-0.0` bit patterns.
- The serialization fixture uses the existing canonical CBOR/F64Bits encoder and PHD-V2-10 digest envelope. Its four-point synthetic example demonstrates signed-zero round trips, equal expanded logical digests, distinct research physical identities, and rejection of a storage-schema mismatch.
- The C++ resource model counts payload, PMR descriptors/metadata, a 250,000-atom spatial-index model, and scratch. It measured 674,904,616 bytes requested field-owned allocation and 681,725,952 bytes peak working set on the latest repeat, under the current ceilings.

Limitations confirmed by the reviewer: the digest, serialization, physical identity, cache, and resource checks are research helpers; there is no production ScoringField serializer/digest/cache. The serialization vector is synthetic and four points per channel. The C++ arrays use synthetic constants and model construction timing is not production field-build timing. Final physical acceptance requires production-layout conformance and resource measurements.

Review method: read-only inspection of the channel map, `sparse_zero_proof.cpp`, `sparse-contract.test.ts`, `resource_model.cpp`, machine-readable outputs, and the preserved scorer source. The reviewer did not run tests or edit files.
