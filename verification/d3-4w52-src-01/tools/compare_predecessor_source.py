"""Confirm the new official download matches the D3-EXT-FIX-01 frozen source."""
from __future__ import annotations

import hashlib
import json
import shlex
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
OLD = REPO / "verification/d3-ext-fix-01/source_artifacts/cif/4W52.cif"
NEW = ROOT / "source_artifacts/cif/4W52_current.cif"
OUT = ROOT / "source_artifacts/derived/4W52_predecessor_source_comparison.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atom_site_rows(path: Path) -> int:
    lines = path.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip() != "loop_":
            i += 1
            continue
        i += 1
        headers = []
        while i < len(lines) and lines[i].lstrip().startswith("_"):
            headers.append(lines[i].strip())
            i += 1
        if headers and headers[0].startswith("_atom_site."):
            count = 0
            while i < len(lines):
                line = lines[i].strip()
                if not line or line.startswith("#") or line == "loop_" or line.startswith("data_") or line.startswith("_"):
                    break
                if len(shlex.split(line, posix=True)) != len(headers):
                    raise ValueError(f"Malformed _atom_site row at {path}:{i + 1}")
                count += 1
                i += 1
            return count
    raise ValueError(f"No _atom_site loop found in {path}")


old_hash, new_hash = sha(OLD), sha(NEW)
old_bytes, new_bytes = OLD.stat().st_size, NEW.stat().st_size
result = {
    "predecessor_commit": "697f6074fa1869bf120d537cbcffd7d85c006981",
    "predecessor_path": str(OLD.relative_to(REPO)),
    "predecessor_bytes": old_bytes,
    "predecessor_sha256": old_hash,
    "current_official_path": str(NEW.relative_to(ROOT)),
    "current_official_url": "https://files.rcsb.org/download/4W52.cif",
    "current_official_bytes": new_bytes,
    "current_official_sha256": new_hash,
    "byte_identical": OLD.read_bytes() == NEW.read_bytes(),
    "predecessor_atom_site_rows": atom_site_rows(OLD),
    "current_atom_site_rows": atom_site_rows(NEW),
}
if not result["byte_identical"] or result["predecessor_atom_site_rows"] != result["current_atom_site_rows"]:
    raise SystemExit("The current official file differs from the predecessor source; reconcile before using it")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
