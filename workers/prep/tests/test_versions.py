"""Task 5.2b: --versions reports the installed toolchain, and it matches the hash-pinned lock and TOOLS.md."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(WORKER))
LAUNCHER = os.path.join(WORKER, "run_prep.py")


def env(**extra):
    e = {"PATH": "/usr/bin:/bin", "PYTHONHASHSEED": "0", "LANG": "C.UTF-8"}
    e.update(extra)
    return e


def versions(environ):
    with tempfile.TemporaryDirectory() as d:  # an empty cwd: --versions needs no job files and writes nothing
        r = subprocess.run([sys.executable, "-I", LAUNCHER, "--versions"], cwd=d, env=environ, capture_output=True, text=True, timeout=120)
        assert os.listdir(d) == []
    return r


def test_versions_match_lock_and_tools_md():
    r = versions(env())
    assert r.returncode == 0, r.stderr
    lines = r.stdout.strip().splitlines()
    assert len(lines) == 1
    rep = json.loads(lines[0])
    assert rep["profileId"] == "ME_PREP_INTERIM_V0"
    lock_text = open(os.path.join(WORKER, "requirements.lock.txt"), "rb").read().replace(b"\r\n", b"\n")
    assert rep["lockDigest"] == hashlib.sha256(lock_text).hexdigest()
    locked = {m.group(1).lower().replace("-", "_"): m.group(2) for m in re.finditer(r"^([A-Za-z0-9_.-]+)==([^\s\\]+)", lock_text.decode(), re.M)}
    tools = rep["tools"]
    assert tools.pop("mole_prep") == rep["workerVersion"]
    for dist, version in tools.items():
        assert locked.get(dist) == version, dist
    md = open(os.path.join(REPO, "native", "third_party", "TOOLS.md"), encoding="utf-8").read()
    assert re.search(r"^\|\s*Worker version\s*\|\s*`" + re.escape(rep["workerVersion"]) + "`", md, re.M)
    assert re.search(r"^\|\s*Lock digest\s*\|\s*`" + rep["lockDigest"] + "`", md, re.M)
    assert re.search(r"Python " + re.escape(rep["python"]), md)


def test_versions_refuses_a_nondeterministic_env():
    r = versions(env(PYTHONHASHSEED="1"))
    assert r.returncode == 2
    assert r.stdout == ""
    assert "DETERMINISM_ENV" in r.stderr
