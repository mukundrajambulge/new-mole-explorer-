"""Write the evidence-lane path list and SHA-256 inventory."""

from __future__ import annotations

import hashlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
LANE = REPO / "verification" / "d3-fixture-ready-03"
PATH_LIST = LANE / "CHANGED_PATHS.txt"
HASH_FILE = LANE / "SHA256SUMS.txt"

files = sorted(
    (p for p in LANE.rglob("*") if p.is_file()),
    key=lambda p: p.relative_to(REPO).as_posix(),
)
paths = {p.relative_to(REPO).as_posix() for p in files}
paths.update({PATH_LIST.relative_to(REPO).as_posix(), HASH_FILE.relative_to(REPO).as_posix()})
PATH_LIST.write_text("\n".join(sorted(paths)) + "\n", encoding="utf-8", newline="\n")

hashes = []
for path in sorted(
    (p for p in LANE.rglob("*") if p.is_file() and p != HASH_FILE),
    key=lambda p: p.relative_to(REPO).as_posix(),
):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    hashes.append(f"{digest}  {path.relative_to(REPO).as_posix()}")
HASH_FILE.write_text("\n".join(hashes) + "\n", encoding="utf-8", newline="\n")
print(f"listed {len(paths)} lane paths; hashed {len(hashes)} lane files")
