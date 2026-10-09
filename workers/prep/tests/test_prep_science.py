"""R.4 ligand stereo (CCD isomeric SMILES), R.5 metals/cofactors in the site, R.6 His states. Real RCSB/CCD files only."""
from __future__ import annotations

import json
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import ccd  # noqa: E402
from test_prep_pairs import FIX, LIG_OPTS, PAIRS, _blocked, _mods, make_job, plan_apply, run  # noqa: E402

GLYCANS = ("GAL", "BMA", "NAG")


def test_templates_are_ccd_isomeric_smiles():
    for p in PAIRS:
        code = p["ligand"]["cut"]["resName"]
        assert p["template"] == ccd.template(code, glycan=code in GLYCANS), p["id"]


@pytest.mark.parametrize("pair", PAIRS, ids=[p["id"] for p in PAIRS])
def test_pair_plan_lists_stereo_his_and_site_hetero(pair, tmp_path):
    d = make_job(pair, str(tmp_path))
    assert run(d, "plan").returncode == 0
    plan = json.load(open(os.path.join(d, "plan.json")))
    st = plan["ligandStereo"]
    assert st["source"] == "ISOMERIC_SMILES_TEMPLATE"
    assert all(e["label"] != "UNDEFINED" or e["hOnly"] for e in st["elements"])
    keys = {x["key"]: x for x in plan["decisions"]}
    assert keys["LIGAND_STEREO"]["requiresAck"] is False
    if any(e["hOnly"] for e in st["elements"]):
        assert keys["LIGAND_STEREO_H_ONLY"]["requiresAck"]
    his = plan["histidines"]
    assert all(h["state"] in ("HID", "HIE", "HIP") and h["source"] in ("SUBMITTED_H", "MEEKO_TEMPLATE", "PROPKA") for h in his)
    if pair["options"].get("protonation") == "PROPKA_PREVIEW":
        assert his and all(h["source"] == "PROPKA" for h in his)
    elif his:
        assert all(h["source"] == "MEEKO_TEMPLATE" for h in his)  # X-ray receptors: no submitted H
    site = [h for h in his if h["inSite"]]
    if site:
        assert keys["HIS_SITE_STATES"]["requiresAck"]
        assert all(f"{h['chain']}:{h['resSeq']}{h['iCode']}={h['state']}" in keys["HIS_SITE_STATES"]["choice"] for h in site)
    else:
        assert "HIS_SITE_STATES" not in keys
    assert not any(g["class"] in ("METAL", "COFACTOR") and g["inSite"] for g in plan["siteHetero"])
    cut = pair["ligand"]["cut"]
    assert any(g["class"] == "LIGAND" and g["group"] == f"{cut['resName']}:{cut['chain']}:{cut['resSeq']}" for g in plan["siteHetero"])


def _stp(template=None):
    return {"id": "1STP-A-BTN300", "receptor": {"file": "rcsb/1STP.pdb"},
            "ligand": {"cut": {"file": "rcsb/1STP.pdb", "resName": "BTN", "chain": "A", "resSeq": 300}, "format": "pdb"},
            "template": template or ccd.template("BTN"), "options": {"chainIds": ["A"], "addMissingAtoms": True}}


def test_biotin_keeps_three_defined_stereocentres(tmp_path):
    from rdkit import Chem

    d, plan, m = plan_apply(_stp(), str(tmp_path))
    assert plan["status"] == "READY" and m["status"] == "PREPARED", plan["diagnostics"] + m["diagnostics"]
    assert m["qualification"] == "PREVIEW_UNQUALIFIED"
    tet = [e for e in plan["ligandStereo"]["elements"] if e["kind"] == "TETRAHEDRAL"]
    want = sorted(c for _i, c in Chem.FindMolChiralCenters(Chem.MolFromSmiles(ccd.ccd_smiles("BTN")), useLegacyImplementation=False))
    assert len(tet) == 3 and sorted(e["label"] for e in tet) == want, tet
    assert len({e["atoms"][0] for e in tet}) == 3 and all(e["atoms"][0].startswith("C") for e in tet)  # PDB atom names
    # The prepared ligand keeps the CCD configuration.
    out = Chem.MolFromMolFile(os.path.join(d, "out", "ligand.clean.sdf"))
    assert Chem.MolToSmiles(out) == Chem.MolToSmiles(Chem.MolFromSmiles(ccd.ccd_smiles("BTN")))
    his = {(h["chain"], h["resSeq"]): h for h in plan["histidines"]}
    assert set(his) == {("A", 87), ("A", 127)} and all(h["inSite"] for h in his.values())
    assert any(x["key"] == "HIS_SITE_STATES" and x["requiresAck"] for x in plan["decisions"])


def test_undefined_stereocentre_blocked(tmp_path):
    ligand, _ = _mods()
    flat = "O=C1NC2C(SCC2N1)CCCCC(=O)O"  # CCD BTN ACDLabs SMILES: same constitution, no stereo
    _blocked(_stp(flat), str(tmp_path), "STEREO_UNDEFINED")
    with pytest.raises(ligand.Blocked) as e:
        ligand.prepare("OC(C(O)C(=O)O)C(=O)O\n", "smi", None, LIG_OPTS)  # tartaric acid, both centres undefined
    assert e.value.code == "STEREO_UNDEFINED"


def test_template_stereo_contradicting_coordinates_blocked(tmp_path):
    inverted = ccd.template("TLA").replace("@@", "!").replace("@", "@@").replace("!", "@")  # D- instead of L-tartrate
    _blocked({**PAIRS[2], "id": "neg-tla-stereo", "template": inverted}, str(tmp_path), "STEREO_MISMATCH")


def _hs4(seq):
    return {"id": f"3HS4-A-AZM{seq}", "receptor": {"file": "rcsb/3HS4.pdb"},
            "ligand": {"cut": {"file": "rcsb/3HS4.pdb", "resName": "AZM", "chain": "A", "resSeq": seq}, "format": "pdb"},
            "template": ccd.template("AZM"), "options": {"chainIds": ["A"], "addMissingAtoms": True}}


def test_zinc_in_site_is_unsupported(tmp_path):
    # Carbonic anhydrase II: acetazolamide 701 binds the catalytic Zn (1.9 A). The Zn is never deleted: UNSUPPORTED.
    d, plan, m = plan_apply(_hs4(701), str(tmp_path))
    assert plan["status"] == "UNSUPPORTED" and m["status"] == "BLOCKED"
    assert plan["diagnostics"][0].startswith("CHEMISTRY_UNSUPPORTED") and "ZN:A:301 (METAL" in plan["diagnostics"][0]
    assert m["diagnostics"][0].startswith("CHEMISTRY_UNSUPPORTED") and m["outputs"] == []
    assert not os.path.exists(os.path.join(d, "out"))


def test_zinc_outside_site_is_a_recorded_removal(tmp_path):
    # AZM 702 is a surface copy with no metal or cofactor within 8 A: removing the Zn is an explicit, acknowledged decision.
    d, plan, m = plan_apply(_hs4(702), str(tmp_path))
    assert plan["status"] == "READY" and m["status"] == "PREPARED", plan["diagnostics"] + m["diagnostics"]
    het = next(x for x in plan["decisions"] if x["key"] == "HETERO")
    assert het["requiresAck"] and "ZN:A:301 [METAL]" in het["choice"]
    zn = next(g for g in plan["siteHetero"] if g["group"] == "ZN:A:301")
    assert zn["class"] == "METAL" and not zn["inSite"] and zn["distance"] > 8.0
    assert len(plan["histidines"]) == 11 and not any(h["inSite"] for h in plan["histidines"])


def test_metal_with_undetermined_site_is_unsupported():
    _, receptor = _mods()
    with pytest.raises(receptor.Blocked) as e:
        receptor.clean(open(os.path.join(FIX, "rcsb", "3HS4.pdb")).read(), {"chainIds": ["A"], "keepWaters": False}, None)
    assert e.value.code == "CHEMISTRY_UNSUPPORTED" and "undetermined" in e.value.message
