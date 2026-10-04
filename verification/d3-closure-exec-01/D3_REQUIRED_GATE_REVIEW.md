# D3 required gate review

## Review mechanism and result

An isolated, read-only independent reviewer examined the current Roadmap, AUTH04 owner package, approved chemistry profile, pinned toolchain proposal, D2 contracts and sealers, PHD-V2-10, and the integrated closure request. The reviewer did not modify the scientific proposal or execute preparation.

**Pre-execution review requirement: PASS. Integrated closure: HOLD.** The Roadmap itself does not require an external human. Roadmap §3.2, paragraphs 109–112 (current revision `ANLCKQl2s3TyUYW5qYe_9qihkOwWtCeF0OLunNFacRrnaFDzv_mD1Y8bU6osvkbh_qqeIBoMFpaqGjWvnPC486UlQH8-6QuwA1pFIpvyZ_M`) requires code review and independent evidence review for closure, without specifying a human or credential. Integrated task §12 separately requests a pre-execution independent review; the read-only reviewer lane satisfies that task-specific timing.

## Evidence reviewed

- Roadmap §3.2 and D3 exit criteria, plus Global Master Plan D3/D4 status.
- AUTH04 owner decision, exception, exact chemistry profile, component/alternate policy, heavy-atom invariant, hydrogen provenance contract, and toolchain proposal.
- D1 and D2 acceptance evidence, D3-TOR, D3-SCI, D3-GRID, fixture readiness, DEC04 source freeze, and relevant PHD-V2 requirements.
- Exact current closure task, including §§2, 12–16, 20–25, and 39.
- Current D2 prepared receptor/ligand types and sealers. D2 V1 binds its fixed consumer profile and does not include the candidate AUTH04 preparation-profile digest in its prepared-state hash.

## Scientific review

The AUTH04 package consistently resolves GLU128 as deprotonated, limits pH 6.9 to crystallization-context proxy use, specifies the 3DMX construct and residue state inventory, fixes the MET106/GLU108 alternate policy, and authorizes hydrogen-only RDKit AddHs with strict heavy-atom invariance and per-hydrogen provenance. No contrary source decision was found in the reviewed records. The fixture and component choices were not reopened.

## Profile digest contract

The integrated task explicitly requires canonical prepared states to include the preparation profile, canonical serialization, and scientific digest. AUTH04 says no canonical candidate-profile digest exists until a schema and serializer are established. The reviewer ruled that this task authorizes a versioned D3 envelope over unchanged D2 V1 state digests and the candidate profile/provenance dependencies. The envelope must be separately named as a D3 object, must not be represented as a D2 V1 digest, and must use the project's canonical CBOR/scientific-digest convention. See `PROFILE_AWARE_ENVELOPE_SCHEMA.md`.

## Authorization conflict

The integrated closure request §25 requires running preparation again. AUTH04 authorizes exactly one development fixture preparation and its standalone prompt explicitly prohibits a second fixture run/replay. Section 2 of the integrated request says the owner record is authoritative and closed; it does not state that the replay instruction amends that record. The reviewer therefore did not treat §25 alone as a clear owner-record amendment. The one allowed preparation remains unconsumed. A second fixture preparation cannot be performed without explicit owner-record amendment or removal of that requirement.

## Runtime finding

The standard Windows installer rolled back. A separately verified official CPython embeddable package starts as CPython 3.13.16 x64 in isolated mode, and the pinned wheels install into its isolated package path. Windows Code Integrity event IDs 3077 and 3033 block the unsigned RDKit `rdBase.pyd` under enterprise policy ID `0283ac0f-fff1-49ae-ada1-8a933130cad6`. This is a hard execution blocker, not a scientific rejection of 3DMX/BNZ.

## Final review disposition

The pre-execution review is complete and passed on the approved scientific choices, with the profile-envelope condition addressed by this task's own scope. Overall closure is **HOLD** because the pinned chemistry engine cannot execute under current device policy and the required second fixture preparation conflicts with the closed one-run authorization. No hydrogen operation was run. The final independent evidence review cannot occur until executable scientific outputs exist.
