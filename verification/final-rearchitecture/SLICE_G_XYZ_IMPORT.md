# Slice G — Bounded XYZ coordinate import

XYZ is now admitted as a single coordinate-bearing molecule. The parser requires a positive atom count, one comment line, and exactly that many four-field element/XYZ records. It preserves the supplied Cartesian coordinates and element symbols.

XYZ does not encode bond topology. Molexplorer therefore creates no bonds and does not infer chemistry from distances. Any trailing coordinate frame is rejected so a multi-frame trajectory is never represented as a single structure.

Verification includes API acceptance for parsed coordinates, source evidence, absence of bonds, and multi-frame rejection; browser acceptance `AT-FSR-G-001` loads the fixture and captures `evidence/SLICE_G_XYZ_IMPORT.png`.
