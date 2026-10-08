"""Task 5.2 done-when: 10 real pairs, plan + apply twice in different temp dirs, byte-identical outputs; negatives BLOCKED."""
from __future__ import annotations

import hashlib
import json
import math
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


GENERATING_STAGES = ("pdbfixer", "pdb2pqr+propka", "dimorphite_dl")


def expected_qualification(m) -> str:
    """Derived from what actually ran / was added, independently of the worker's own flag."""
    s = m["summary"]
    generated = (any(st["tool"] in GENERATING_STAGES for st in m["stages"]) or s["receptorHydrogensAdded"] > 0 or s["ligandHydrogensAdded"] > 0
                 or s["ligandEmbedded3d"])
    return "PREVIEW_UNQUALIFIED" if generated else "INTERIM"


def expected_protonation_source(pair, m) -> str:
    if pair.get("options", {}).get("protonation") == "PROPKA_PREVIEW":
        return "PROPKA_PREVIEW"
    return "MEEKO_TEMPLATES_PREVIEW" if m["summary"]["receptorHydrogensAdded"] > 0 else "EXPLICIT_SUBMITTED"


def test_pairs_file_has_ten_real_complexes():
    assert len(PAIRS) == 10 and len({p["id"] for p in PAIRS}) == 10
    for p in PAIRS:
        # Real complex: ligand cut from the same entry as the receptor, receptor restricted to explicit chains.
        assert p["ligand"]["cut"]["file"] == p["receptor"]["file"], p["id"]
        assert p["options"].get("chainIds"), p["id"]
        assert p["expect"] in ("INTERIM", "PREVIEW_UNQUALIFIED")


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
    # Owner rule, asserted for EVERY pair: PREVIEW_UNQUALIFIED whenever anything was generated, INTERIM only otherwise.
    assert m1["qualification"] == plan1["qualification"] == expected_qualification(m1) == pair["expect"], (pair["id"], m1["qualification"])
    assert m1["summary"]["protonationSource"] == plan1["protonationSource"] == expected_protonation_source(pair, m1)
    if m1["summary"]["ligandHydrogensAdded"]:
        assert any(d["key"] == "LIGAND_HYDROGENS" and d["requiresAck"] and "PREVIEW_UNQUALIFIED" in d["choice"] for d in plan1["decisions"])
    assert plan1["inputs"]["receptorSha256"] == hashlib.sha256(open(os.path.join(d1, "in", "receptor.pdb"), "rb").read()).hexdigest()
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
    # 1CRN with ALA 9 relabelled GLY (its CB no longer fits any template): BLOCKED with a diagnostic, never a crash.
    lines = open(os.path.join(FIX, "rcsb", "1CRN.pdb")).read().splitlines()
    out = [ln[:17] + "GLY" + ln[20:] if ln.startswith("ATOM") and ln[17:20] == "ALA" and int(ln[22:26]) == 9 else ln for ln in lines]
    assert out != lines
    _blocked({"id": "neg-template", "receptor": {"text": "\n".join(out) + "\n"}, "ligand": ETHANOL}, str(tmp_path), "TEMPLATE_MISMATCH")


def _mods():
    if WORKER not in sys.path:
        sys.path.insert(0, WORKER)
    from mole_prep import ligand, receptor

    return ligand, receptor


def test_pdbfixer_terminal_oxt_has_ideal_geometry():
    # Regression: PDBFixer put 5FYL chain B ASP 664 OXT 1.75 A from CA, so Meeko's C-terminal template failed.
    _, receptor = _mods()
    opts = {"chainIds": ["B"], "keepWaters": False, "addMissingAtoms": True}
    atoms, _, _ = receptor.clean(open(os.path.join(FIX, "rcsb", "5FYL.pdb")).read(), opts)
    fixed, n_missing, st, n_oxt = receptor.run_pdbfixer(receptor.write_pdb(atoms), opts)
    assert n_missing >= 1 and n_oxt == 1 and st is not None
    res = {a["name"].strip(): a for a in receptor.parse_pdb(fixed)[0] if a["chain"] == "B" and a["seq"] == 664}
    dist = lambda p, q: math.dist((p["x"], p["y"], p["z"]), (q["x"], q["y"], q["z"]))  # noqa: E731
    assert abs(dist(res["C"], res["OXT"]) - 1.25) < 0.01
    assert dist(res["CA"], res["OXT"]) > 2.2 and dist(res["O"], res["OXT"]) > 2.0


def test_microheterogeneity_keeps_one_residue():
    # 1CRN SER 6 split into alt A SER (0.6) and alt B ALA (0.4): exactly one residue (SER) must survive.
    _, receptor = _mods()
    lines = open(os.path.join(FIX, "rcsb", "1CRN.pdb")).read().splitlines()
    out = []
    for ln in lines:
        if ln.startswith("ATOM") and int(ln[22:26]) == 6:
            assert ln[17:20] == "SER"
            out.append(ln[:16] + "A" + ln[17:54] + "  0.60" + ln[60:])
            if ln[12:16].strip() in ("N", "CA", "C", "O", "CB"):
                out.append(ln[:16] + "BALA" + ln[20:54] + "  0.40" + ln[60:])
        else:
            out.append(ln)
    atoms, decisions, _ = receptor.clean("\n".join(out) + "\n", {"chainIds": None, "keepWaters": False})
    res6 = [a for a in atoms if a["seq"] == 6]
    assert {a["res"] for a in res6} == {"SER"} and len(res6) == len({a["name"] for a in res6}) == 6
    micro = [x for x in decisions if x["key"] == "MICROHETEROGENEITY"]
    assert micro and micro[0]["requiresAck"] and "A:SER/B:ALA->SER" in micro[0]["choice"]


LIG_OPTS = {"ligandProtonation": "EXPLICIT_SUBMITTED", "pH": 7.4}


def test_ligand_generated_hydrogens_and_coordinates_are_flagged():
    ligand, _ = _mods()
    sdf = open(os.path.join(FIX, "ethanol.sdf")).read()  # heavy atoms only, 2D (z = 0): RDKit adds H, ETKDG embeds
    r = ligand.prepare(sdf, "sdf", None, LIG_OPTS)
    keys = {d["key"]: d for d in r["decisions"]}
    assert r["generated"] and r["hAdded"] == 6 and r["embedded"]
    assert keys["LIGAND_HYDROGENS"]["requiresAck"] and keys["LIGAND_3D_EMBED"]["requiresAck"]
    r = ligand.prepare("CCO\n", "smi", None, LIG_OPTS)
    assert r["generated"] and r["embedded"]
    pdb = cut_hetatm("rcsb/1IEP.pdb", "STI", "A", 201)
    r = ligand.prepare(pdb, "pdb", PAIRS[4]["template"], LIG_OPTS)
    assert r["generated"] and not r["embedded"] and r["hAdded"] > 0


def test_nothing_generated_is_interim(tmp_path):
    # Re-prepare prepared outputs of a real complex: all H and 3D coordinates are now submitted, so nothing is generated.
    pair = next(p for p in PAIRS if p["id"] == "1IEP-A-STI201")
    d, plan, m = plan_apply(pair, str(tmp_path))
    assert m["status"] == "PREPARED" and m["qualification"] == "PREVIEW_UNQUALIFIED"
    again = {"id": "rt-1IEP", "receptor": {"text": open(os.path.join(d, "out", "receptor.clean.pdb")).read()},
             "ligand": {"text": open(os.path.join(d, "out", "ligand.clean.sdf")).read(), "format": "sdf"}, "options": {}}
    d2, plan2, m2 = plan_apply(again, str(tmp_path))
    assert m2["status"] == "PREPARED", m2["diagnostics"]
    assert m2["summary"]["receptorHydrogensAdded"] == 0 and m2["summary"]["ligandHydrogensAdded"] == 0, m2["summary"]
    assert m2["qualification"] == plan2["qualification"] == "INTERIM" == expected_qualification(m2)
    assert m2["summary"]["protonationSource"] == "EXPLICIT_SUBMITTED"


def test_input_swapped_after_plan_blocked(tmp_path):
    pair = next(p for p in PAIRS if p["id"] == "5FYL-B-NAG1665")
    d = make_job(pair, str(tmp_path))
    assert run(d, "plan").returncode == 0
    plan = json.load(open(os.path.join(d, "plan.json")))
    confirm(d, plan)
    with open(os.path.join(d, "in", "receptor.pdb"), "a") as f:
        f.write("REMARK 999 swapped after plan\n")
    assert run(d, "apply").returncode == 3
    assert json.load(open(os.path.join(d, "prep-manifest.json")))["diagnostics"][0].startswith("PLAN_DIGEST_MISMATCH")
    assert not os.path.exists(os.path.join(d, "out"))


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
