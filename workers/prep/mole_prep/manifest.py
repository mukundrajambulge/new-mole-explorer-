"""Canonical JSON, hashing, provenance records and atomic writes (no timestamps, no absolute paths)."""
from __future__ import annotations

import hashlib
import json
import os
from importlib import metadata

PROFILE_ID = "ME_PREP_INTERIM_V0"
WORKER_VERSION = "0.1.0"
_LOCK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "requirements.lock.txt")
TOOL_DISTS = ("rdkit", "meeko", "dimorphite_dl", "pdbfixer", "openmm", "pdb2pqr", "propka", "numpy", "scipy", "gemmi")


def canonical_bytes(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("ascii")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def lock_digest() -> str:
    """sha256 of the hash-pinned lock file this worker ships with (LF-normalised, so checkouts agree)."""
    with open(_LOCK, "rb") as f:
        return sha256_bytes(f.read().replace(b"\r\n", b"\n"))


def tool_version(dist: str) -> str:
    try:
        return metadata.version(dist)
    except metadata.PackageNotFoundError:
        return "UNAVAILABLE"


def tool_versions() -> dict:
    return {d: tool_version(d) for d in TOOL_DISTS} | {"mole_prep": WORKER_VERSION}


def plan_digest(plan_without_digest: dict, lock: str) -> str:
    """planDigest = sha256(canonical plan JSON || lock digest hex)."""
    return sha256_bytes(canonical_bytes(plan_without_digest) + lock.encode("ascii"))


def profile_digest(options: dict, lock: str) -> str:
    """Digest of ME_PREP_INTERIM_V0 as run: profile id, every tool version, the lock and all options."""
    return sha256_bytes(canonical_bytes({"profileId": PROFILE_ID, "tools": tool_versions(), "lockDigest": lock, "options": options}))


def stage(tool: str, version: str, params: dict, in_sha: str, out_sha: str, decisions: list[str]) -> dict:
    clean = {}
    for k, v in sorted(params.items()):
        if isinstance(v, bool) or isinstance(v, (int, float)):
            clean[k[:64]] = v
        else:
            clean[k[:64]] = str(v)[:200]
    return {"tool": tool[:64], "version": version[:32], "params": clean, "inSha": in_sha, "outSha": out_sha, "decisions": [d[:500] for d in decisions][:200]}


def write_atomic(root: str, rel: str, data: bytes) -> dict:
    full = os.path.join(root, *rel.split("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, full)
    return {"relPath": rel, "sha256": sha256_bytes(data), "bytes": len(data)}


def write_json(root: str, rel: str, obj) -> dict:
    return write_atomic(root, rel, json.dumps(obj, sort_keys=True, indent=1, ensure_ascii=True, allow_nan=False).encode("ascii") + b"\n")
