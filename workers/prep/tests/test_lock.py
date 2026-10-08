import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def pins(name):
    out = {}
    for line in (ROOT / name).read_text().splitlines():
        m = re.fullmatch(r"([A-Za-z0-9_.-]+)==([^\s#]+)", line.strip())
        if m:
            out[m.group(1).lower().replace("-", "_")] = m.group(2)
    return out


def test_direct_pins_present_and_locked():
    direct = pins("requirements.in")
    assert set(direct) >= {"rdkit", "meeko", "dimorphite_dl", "pdb2pqr", "propka"}
    locked = pins("requirements.lock.txt")
    for k, v in direct.items():
        assert locked.get(k) == v


def test_tools_md_lists_versions():
    text = (ROOT.parents[1] / "native" / "third_party" / "TOOLS.md").read_text()
    for v in pins("requirements.in").values():
        assert v in text
