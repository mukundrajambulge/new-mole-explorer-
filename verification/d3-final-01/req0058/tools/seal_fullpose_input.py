#!/usr/bin/env python3
"""Seal the deterministic D3 full-pose JSON bundle using its canonical wire digest."""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
from typing import Any


def no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON object key: {key}")
        result[key] = value
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=pathlib.Path)
    args = parser.parse_args()
    value = json.loads(args.bundle.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_keys)
    if not isinstance(value, dict) or value.get("schemaId") != "MOLE_D3_FULLPOSE_INPUT_V1":
        raise ValueError("full-pose bundle schema is invalid")
    value.pop("bundleDigest", None)
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    value["bundleDigest"] = "sha256:" + hashlib.sha256(canonical).hexdigest()
    args.bundle.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": "PASS", "bundleDigest": value["bundleDigest"], "bundleSha256": hashlib.sha256(args.bundle.read_bytes()).hexdigest()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
