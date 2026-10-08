import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DIRECT = {"rdkit", "meeko", "dimorphite_dl", "pdb2pqr", "propka", "pdbfixer", "scipy", "gemmi"}
VINA_SHA = "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644"


def norm(n):
    return n.lower().replace("-", "_")


def pins(name):
    out = {}
    for line in (ROOT / name).read_text().splitlines():
        m = re.match(r"([A-Za-z0-9_.-]+)==([^\s;\#]+)", line.strip())
        if m:
            out[norm(m.group(1))] = m.group(2)
    return out


def test_direct_pins_present_and_locked():
    direct = pins("requirements.in")
    assert set(direct) == DIRECT
    locked = pins("requirements.lock.txt")
    for k, v in direct.items():
        assert locked.get(k) == v, k


def test_lock_is_complete_transitive_and_hashed():
    text = (ROOT / "requirements.lock.txt").read_text()
    locked = pins("requirements.lock.txt")
    assert DIRECT <= set(locked)
    assert {"numpy", "openmm"} <= set(locked)
    entries = re.findall(r"^[A-Za-z0-9_.-]+==", text, re.M)
    hashed = re.findall(r"^[A-Za-z0-9_.-]+==\S+ \\\n\s+--hash=sha256:", text, re.M)
    assert len(entries) == len(hashed) == len(locked)


def test_tools_md_lists_every_direct_version():
    text = (REPO / "native" / "third_party" / "TOOLS.md").read_text()
    for v in pins("requirements.in").values():
        assert v in text
    assert "NOT INSTALLED" not in text and "UNVERIFIED" not in text


def test_vina_sha256_recorded_and_enforced():
    tools = (REPO / "native" / "third_party" / "TOOLS.md").read_text()
    setup = (REPO / "scripts" / "wsl-setup.sh").read_text()
    assert VINA_SHA in tools
    assert VINA_SHA in setup and "sha256sum -c" in setup
