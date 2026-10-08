"""Task 5.2 done-when: 10 real pairs, plan + apply twice in different temp dirs, byte-identical outputs; negatives BLOCKED."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(WORKER))
FIX = os.path.join(REPO, "tests", "fixtures")
LAUNCHER = os.path.join(WORKER, "run_prep.py")
PAIRS = json.load(open(os.path.join(HERE, "pairs.json")))["pairs"]
DEFAULT_OPTS = {"pH": 7.4, "protonation": "EXPLICIT_SUBMITTED", "ligandProtonation": "EXPLICIT_SUBMITTED", "chainIds": None, "keepWaters": False, "addMissingAtoms": False}


def worker_env(**extra):
    env = {"PATH": os.path.dirname(sys.executable) + ":/usr/bin:/bin", "PYTHONHASHSEED": "0", "LANG": "C.UTF-8", "HOME": os.environ.get("HOME", "/tmp")}
    env.update(extra)
    return env


def run(job_dir, mode, env=None):
    return subprocess.run([sys.executable, "-I", LAUNCHER, f"--{mode}"], cwd=job_dir, env=env or worker_env(), capture_output=True, text=True, timeout=900)


def cut_hetatm(rel, res, chain, seq):
    lines = [ln for ln in open(os.path.join(FIX, rel)).read().splitlines()
             if ln.startswith("HETATM") and ln[17:20].strip() == res and ln[21] == chain and int(ln[22:26]) == seq]
    assert lines, f"{res} {chain}{seq} not found in {rel}"
    return "\n".join(lines) + "\nEND\n"


def make_job(pair, base):
    d = tempfile.mkdtemp(prefix="mole-prep-", dir=base)
    os.makedirs(os.path.join(d, "in"))
    rec = pair["receptor"]
    if "text" in rec:
        open(os.path.join(d, "in", "receptor.pdb"), "w").write(rec["text"])
    else:
        shutil.copyfile(os.path.join(FIX, rec["file"]), os.path.join(d, "in", "receptor.pdb"))
    lig = pair["ligand"]
    ext = lig["format"]
    if "cut" in lig:
        c = lig["cut"]
        open(os.path.join(d, "in", f"ligand.{ext}"), "w").write(cut_hetatm(c["file"], c["resName"], c["chain"], c["resSeq"]))
    elif "text" in lig:
        open(os.path.join(d, "in", f"ligand.{ext}"), "w").write(lig["text"])
    else:
        shutil.copyfile(os.path.join(FIX, lig["file"]), os.path.join(d, "in", f"ligand.{ext}"))
    job = {"schemaVersion": 1, "jobId": "job-" + pair["id"].replace(".", "-"),
           "receptor": {"artifactId": "rec1", "relPath": "in/receptor.pdb", "format": "pdb"},
           "ligand": {"artifactId": "lig1", "relPath": f"in/ligand.{ext}", "format": ext},
           "options": {**DEFAULT_OPTS, **pair.get("options", {})}}
    if pair.get("template"):
        open(os.path.join(d, "in", "template.smi"), "w").write(pair["template"] + "\n")
        job["ligandTemplate"] = {"artifactId": "tpl1", "relPath": "in/template.smi", "format": "smi"}
    json.dump(job, open(os.path.join(d, "job.json"), "w"))
    return d


def confirm(d, plan, acks=None, digest=None):
    keys = [x["key"] for x in plan["decisions"] if x["requiresAck"]] if acks is None else acks
    json.dump({"jobId": plan["jobId"], "planDigest": digest or plan["planDigest"], "acks": keys}, open(os.path.join(d, "confirmation.json"), "w"))


def plan_apply(pair, base):
    d = make_job(pair, base)
    r = run(d, "plan")
    assert r.returncode in (0, 3), r.stderr[-800:]
    plan = json.load(open(os.path.join(d, "plan.json")))
    confirm(d, plan)
    r2 = run(d, "apply")
    assert r2.returncode in (0, 3), r2.stderr[-800:]
    manifest = json.load(open(os.path.join(d, "prep-manifest.json")))
    return d, plan, manifest


def digests(d):
    out = {}
    for root, _dirs, files in os.walk(d):
        for f in files:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, d).replace(os.sep, "/")
            if rel.startswith("in/") or rel in ("job.json", "confirmation.json"):
                continue
            out[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out


@pytest.fixture(scope="module")
def bases():
    a, b = tempfile.mkdtemp(prefix="prepA-"), tempfile.mkdtemp(prefix="prepB-")
    yield a, b
    shutil.rmtree(a, ignore_errors=True)
    shutil.rmtree(b, ignore_errors=True)


def test_pairs_file_has_ten_real_pairs():
    assert len(PAIRS) == 10 and len({p["id"] for p in PAIRS}) == 10


@pytest.mark.parametrize("pair", PAIRS, ids=[p["id"] for p in PAIRS])
def test_pair_prepares_deterministically(pair, bases):
    d1, plan1, m1 = plan_apply(pair, bases[0])
    d2, plan2, m2 = plan_apply(pair, bases[1])
    assert plan1["status"] == "READY", plan1["diagnostics"]
    assert m1["status"] == "PREPARED", m1["diagnostics"]
    assert plan1["profileId"] == m1["profileId"] == "ME_PREP_INTERIM_V0"
    h1, h2 = digests(d1), digests(d2)
    assert h1 == h2, "outputs differ between runs"
    assert {"plan.json", "prep-manifest.json", "out/receptor.pdbqt", "out/ligand.pdbqt", "out/ligand.clean.sdf", "out/receptor.clean.pdb",
            "out/receptor.canonical.json", "out/ligand.canonical.json"} == set(h1)
    for o in m1["outputs"]:
        data = open(os.path.join(d1, o["relPath"]), "rb").read()
        assert hashlib.sha256(data).hexdigest() == o["sha256"] and len(data) == o["bytes"]
        assert d1.encode() not in data and b"/tmp" not in data, f"absolute path leaked into {o['relPath']}"
    preview = pair["options"].get("protonation") == "PROPKA_PREVIEW" or pair["options"].get("ligandProtonation") == "DIMORPHITE_PREVIEW"
    if preview:
        assert m1["qualification"] == "PREVIEW_UNQUALIFIED"
    s = m1["summary"]
    assert s["ligandAtoms"] > 0 and s["receptorAtoms"] > 0 and 0 <= s["rotatableBonds"] <= 100
    assert all(st["inSha"] and st["outSha"] for st in m1["stages"])


# ---- negative cases (all real-file derived) ----

def _blocked(pair, base, code):
    d, plan, manifest = plan_apply(pair, base)
    assert plan["status"] == "BLOCKED" and manifest["status"] == "BLOCKED"
    assert any(x.startswith(code) for x in plan["diagnostics"]), plan["diagnostics"]
    assert manifest["outputs"] == [] and not os.path.exists(os.path.join(d, "out"))
    blob = open(os.path.join(d, "plan.json")).read() + open(os.path.join(d, "prep-manifest.json")).read()
    assert d not in blob
    return d


ETHANOL = {"file": "ethanol.sdf", "format": "sdf"}


def test_malformed_receptor_blocked(tmp_path):
    _blocked({"id": "neg-malformed", "receptor": {"file": "g1c-malformed.pdb"}, "ligand": ETHANOL}, str(tmp_path), "MALFORMED_INPUT")


def test_unsupported_element_blocked(tmp_path):
    text = open(os.path.join(FIX, "ethanol.sdf")).read().replace(" O   0", " Si  0")
    assert "Si" in text
    _blocked({"id": "neg-element", "receptor": {"file": "rcsb/1CRN.pdb"}, "ligand": {"text": text, "format": "sdf"}}, str(tmp_path), "UNSUPPORTED_ELEMENT")


def test_oversize_receptor_blocked(tmp_path):
    base = open(os.path.join(FIX, "rcsb", "1CRN.pdb")).read()
    pad = ("REMARK 999 " + "X" * 68 + "\n") * (21 * 1024 * 1024 // 80 + 1)
    _blocked({"id": "neg-oversize", "receptor": {"text": pad + base}, "ligand": ETHANOL}, str(tmp_path), "OVERSIZE_INPUT")


def test_missing_bond_orders_blocked(tmp_path):
    _blocked({"id": "neg-bondorders", "receptor": {"file": "rcsb/1CRN.pdb"}, "ligand": {"file": "g1c-small-molecule.pdb", "format": "pdb"}}, str(tmp_path), "MISSING_BOND_ORDERS")


def test_nan_coordinates_blocked(tmp_path):
    lines = open(os.path.join(FIX, "rcsb", "1CRN.pdb")).read().splitlines()
    i = next(k for k, ln in enumerate(lines) if ln.startswith("ATOM"))
    lines[i] = lines[i][:30] + "     nan" + lines[i][38:]
    _blocked({"id": "neg-nan", "receptor": {"text": "\n".join(lines) + "\n"}, "ligand": ETHANOL}, str(tmp_path), "NON_FINITE_COORDINATES")


def test_meeko_template_failure_blocked(tmp_path):
    # 5FYL chain B C-terminus after PDBFixer cannot be built by Meeko's templates: BLOCKED, never a crash.
    _blocked({"id": "neg-template", "receptor": {"file": "rcsb/5FYL.pdb"}, "ligand": ETHANOL, "options": {"chainIds": ["B"], "addMissingAtoms": True}},
             str(tmp_path), "TEMPLATE_MISMATCH")


def test_stale_digest_and_missing_ack_blocked(tmp_path):
    pair = PAIRS[0]
    d = make_job(pair, str(tmp_path))
    assert run(d, "plan").returncode == 0
    plan = json.load(open(os.path.join(d, "plan.json")))
    confirm(d, plan, digest="0" * 64)
    assert run(d, "apply").returncode == 3
    assert json.load(open(os.path.join(d, "prep-manifest.json")))["diagnostics"][0].startswith("PLAN_DIGEST_MISMATCH")
    required = [x["key"] for x in plan["decisions"] if x["requiresAck"]]
    assert required, "pair 0 must have at least one decision requiring acknowledgement"
    confirm(d, plan, acks=required[1:])
    assert run(d, "apply").returncode == 3
    assert json.load(open(os.path.join(d, "prep-manifest.json")))["diagnostics"][0].startswith("ACK_MISSING")
    assert not os.path.exists(os.path.join(d, "out"))


def test_path_traversal_and_env_rejected(tmp_path):
    d = make_job(PAIRS[0], str(tmp_path))
    job = json.load(open(os.path.join(d, "job.json")))
    job["receptor"]["relPath"] = "../../etc/passwd"
    json.dump(job, open(os.path.join(d, "job.json"), "w"))
    r = run(d, "plan")
    assert r.returncode == 3
    assert json.load(open(os.path.join(d, "plan.json")))["diagnostics"][0].startswith("PATH_REJECTED")
    env = worker_env()
    env.pop("PYTHONHASHSEED")
    r = run(d, "plan", env=env)
    assert r.returncode == 2 and "DETERMINISM_ENV" in r.stderr and d not in r.stderr
