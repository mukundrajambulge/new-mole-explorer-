"""Write the lane's changed-path and SHA-256 evidence manifests."""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
PATHS_FILE = ROOT / "CHANGED_PATHS.txt"
SUMS_FILE = ROOT / "SHA256SUMS.txt"

PATHS_FILE.touch(exist_ok=True)
SUMS_FILE.touch(exist_ok=True)
files = sorted(p for p in ROOT.rglob("*") if p.is_file())
relative = [p.relative_to(REPO).as_posix() for p in files]
with PATHS_FILE.open("w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(relative) + "\n")

lines = []
for path in files:
    if path == SUMS_FILE:
        continue
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(REPO).as_posix()}")
with SUMS_FILE.open("w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(lines) + "\n")
print(f"paths={len(relative)}; hashed={len(lines)}; excluded_self=SHA256SUMS.txt")
