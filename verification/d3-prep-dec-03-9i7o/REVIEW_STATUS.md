# Review and authority status

## Codex analysis

Codex performed the source/state audit in this lane and authored the structural-biology and computational-chemistry review materials. These are AI analyses, not domain-expert signatures.

## Prior internal review

The D3-FIXTURE-COHORT-02 evidence records a separate internal read-only AI source/structural review with a “qualified yes” to advancing 9I7O to a candidate-specific authorization prompt, conditional on disclosing the natural A/B mixture, unresolved loop, and pH discrepancy. That review preceded this gate and was not an independent human review or preparation authorization.

## Owner decisions

**Pending / not supplied for this gate.** No owner sign-off is recorded for:

- using the coherent major-A residue/rotamer state as the one development receptor state;
- the pH/context for receptor preparation;
- receptor protonation, histidine, terminus, and hydrogen policy;
- representing the missing Leu17 and AEPE loop without reconstruction;
- an exact preparation profile/toolchain;
- the ligand kinematic model/scorer torsion fields; or
- the exact future SearchRegion.

## Independent human review

- Structural biology: **not performed / no approval supplied**.
- Computational chemistry: **not performed / no approval supplied**.

No reviewer name, credential, or approval is invented. The two review files are review materials awaiting qualified human response.

## Normative authority records consulted

- **Canonical SOT:** “Mole Explorer Global Master Plan and Source of Truth,” Drive ID 1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk, revision ANLCKQnc_AISwG2QdjWbaEKBkqGfdeCtyMHUrfKdUzfOPfVPWxj2SPJ5WPGgoNeyET_YMydsAQ9_zWw7RDyS0OdQWEtq2z-WxtO_Q3eZMB8 (updated 2026-10-01). It records no approved prep profile; Meeko v0.8.0 reference-only; automatic pKa/protonation, tautomer, conformer/minimization experimental/unvalidated; full D3 HOLD; D4 BLOCKED; DOCKING.RUN unavailable.
- **Execution Roadmap:** “Mole Explorer Execution Roadmap and Master Plan,” Drive ID 1YDNaYI9xe9l3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU, revision ANLCKQl2s3TyUYW5qYe_9qihkOwWtCeF0OLunNFacRrnaFDzv_mD1Y8bU6osvkbh_qqeIBoMFpaqGjWvnPC486UlQH8-6QuwA1pFIpvyZ_M. Gate scope requires written authorization; preparation remains explicit-state only and DOCKING.RUN unavailable.
- **PHD-V2-03:** receptor identity/assembly/altloc/missing-residue/termini/protonation/water rules; requires explicit biological and chemical choices, prohibits automatic missing-loop rebuilding, says coordinate breaks do not define termini, and requires target pH plus explicit residue microstates for a generated receptor protonation state.
- **PHD-V2-04:** explicit ligand graph/state/coordinate/kinematic model; no generic sanitization, canonical-tautomer, toolkit-rotor or PDBQT shortcut; distinguishes search torsions from scorer/TORSDOF.
- **PHD-V2-06:** exact supported atom-type/scoring capability; CORE_DRY_V1 has no explicit water support; scorer torsion quantity is profile-specific and separate.
- **PHD-V2-10:** canonical CBOR/hash/provenance profile ME_CANONICAL_CBOR_V1_1_0; source byte identity distinct from scientific-state identity.
- **PHD-V2-15:** ordinary V1 consumes explicit resolved receptor/ligand states; automatic preparation choices not approved; Meeko v0.8.0 remains reference-only and production preparer selection is separately governed.
- **Normalized requirements / final acceptance:** exact single PreparedReceptorState, PreparedLigandState, LigandKinematicModel and SearchRegion; automatic chemical-state generation is not part of the ordinary V1 core.

Drive links: [SOT](https://docs.google.com/document/d/1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk/edit), [Roadmap](https://docs.google.com/document/d/1YDNaYI9xe9l3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU/edit), [PHD-V2-03](https://docs.google.com/document/d/1VtrX3w3vteUG13n-mxHD4viUv4P2U4EPw3ZlMp5s3pc/edit), [PHD-V2-04](https://docs.google.com/document/d/1zxVZircusto_SLKmNoAMb9nmcyG7r9hx7ckkxyxUwIs/edit), [PHD-V2-06](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit), [PHD-V2-10](https://docs.google.com/document/d/1cT0ZQS6jyinp4KCthDKH3DOdsAAYTDsxRvShJ-JGP2I/edit), [PHD-V2-15](https://docs.google.com/document/d/1k7dUxcAOWfJ1IeJ1cRqeNV8rTVuTZmiMicjHIVEfmpM/edit).