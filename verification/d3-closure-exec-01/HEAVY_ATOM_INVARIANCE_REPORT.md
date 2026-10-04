# Heavy-atom invariance report

**Status: NOT EVALUATED — fixture preparation did not start.**

The byte-exact 3DMX and BNZ source artifacts were hash-verified on Windows and WSL. The hash-gated mmCIF preflight parsed the source, then failed closed at the first alternate state not covered by the frozen profile (ASN68). It did not accept a receptor atom graph or pass a fixture molecule to RDKit. No selected-atom manifest, pre-H graph, post-H graph, in-memory fixture coordinate snapshot, or serialization round trip exists.

Therefore this task has no fixture evidence for zero additions/deletions, bitwise in-memory coordinate identity, stable AtomUID mapping, or the separate 0.001 Å serialization/read-back bound. Safe synthetic controls did preserve their heavy-atom coordinates/bonds, but they do not prove the fixture invariant. No fixture invariant pass is claimed.
