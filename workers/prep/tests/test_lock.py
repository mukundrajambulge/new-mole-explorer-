import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DIRECT = {"rdkit", "meeko", "dimorphite_dl", "pdb2pqr", "propka", "pdbfixer"}
VINA_SHA = "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644"


def norm(n):
    return n.lower().replace("-", "_")


def pins(name):
    out = {}
    for line in (ROOT / name).read_text().splitlines():
        m = re.match(r"([A-Za-z0-9_.-]+)==([^\s;\\#]+)", line.strip())
        if m:
            out[norm(m.group(1))] = m.group(2)
    return out


def lock_is_partial():
    return "PARTIAL" in (ROOT / "requirements.lock.txt").read_text()


def test_direct_pins_present_and_locked():
    if "pdbfixer" not in pins("requirements.in"):
        pytest.skip("PDBFixer pin pending: needs WSL network (scripts/lock-prep.sh)")
    direct = pins("requirements.in")
    assert set(direct) >= DIRECT
    locked = pins("requirements.lock.txt")
    for k, v in direct.items():
        assert locked.get(k) == v


def test_lock_is_complete_transitive_and_hashed():
    if lock_is_partial():
        pytest.skip("lock still PARTIAL: run scripts/lock-prep.sh in WSL")
    text = (ROOT / "requirements.lock.txt").read_text()
    locked = pins("requirements.lock.txt")
    assert DIRECT <= set(locked)
    assert "numpy" in locked and len(locked) > len(DIRECT)
    entries = re.findall(r"^[A-Za-z0-9_.-]+==", text, re.M)
    assert text.count("--hash=sha256:") >= len(entries)


def test_tools_md_lists_versions():
    text = (REPO / "native" / "third_party" / "TOOLS.md").read_text()
    for v in pins("requirements.in").values():
        assert v in text
    assert "NOT INSTALLED" not in text or lock_is_partial()


def test_vina_sha256_recorded_and_enforced():
    tools = (REPO / "native" / "third_party" / "TOOLS.md").read_text()
    setup = (REPO / "scripts" / "wsl-setup.sh").read_text()
    assert VINA_SHA in tools
    assert VINA_SHA in setup and "sha256sum -c" in setup
