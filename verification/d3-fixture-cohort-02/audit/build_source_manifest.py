"""Write a stable SHA-256 manifest for all retained source artifacts."""

from __future__ import annotations

import hashlib
from pathlib import Path

root = Path(__file__).parents[1]
source_root = root / "source_artifacts"
manifest = source_root / "SHA256SUMS.txt"

rows = []
for path in sorted(p for p in source_root.rglob("*") if p.is_file() and p != manifest):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    rows.append(f"{digest}  {path.relative_to(source_root).as_posix()}")

manifest.write_text("\n".join(rows) + "\n", encoding="utf-8", newline="\n")
print(f"Wrote {len(rows)} SHA-256 entries to {manifest}")
