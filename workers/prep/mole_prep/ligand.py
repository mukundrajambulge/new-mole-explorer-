"""Ligand preparation: RDKit (explicit bond orders required) -> [Dimorphite-DL] -> [ETKDG] -> Meeko PDBQT."""
from __future__ import annotations

import re

from . import limits
from .limits import Blocked
from .manifest import sha256_text, stage, tool_version

ETKDG_SEED = 0xF00D
FORMATS = ("sdf", "mol", "mol2", "smi", "pdb")


def _decision(key, choice, before, after, ack):
    return {"key": key, "choice": choice[:500], "atomsBefore": int(before), "atomsAfter": int(after), "requiresAck": bool(ack)}


def _first_smiles(text: str, what: str) -> str:
    toks = [ln.split()[0] for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if len(toks) != 1:
        raise Blocked("MULTIPLE_LIGANDS" if toks else "MALFORMED_INPUT", f"{what} must contain exactly one SMILES")
    if len(toks[0]) > 2000:
        raise Blocked("OVERSIZE_INPUT", f"{what} SMILES is too long")
    return toks[0]


def _check_atoms(mol, what: str) -> None:
    if mol.GetNumAtoms() == 0:
        raise Blocked("MALFORMED_INPUT", f"{what} has no atoms")
    if mol.GetNumAtoms() > limits.MAX_LIGAND_ATOMS:
        raise Blocked("OVERSIZE_INPUT", f"{what} has more than {limits.MAX_LIGAND_ATOMS} atoms")
    bad = sorted({a.GetSymbol() for a in mol.GetAtoms() if a.GetSymbol() not in limits.LIGAND_ELEMENTS})
    if bad:
        raise Blocked("UNSUPPORTED_ELEMENT", f"{what} elements not supported by the interim profile: {','.join(bad)}")
    if mol.GetNumConformers():
        conf = mol.GetConformer()
        limits.require_finite([c for i in range(mol.GetNumAtoms()) for c in conf.GetAtomPosition(i)], what)


def _check_bond_orders(mol, what: str) -> None:
    from rdkit import Chem

    unknown = (Chem.BondType.UNSPECIFIED, Chem.BondType.OTHER, Chem.BondType.ZERO)
    if any(b.GetBondType() in unknown or b.HasQuery() for b in mol.GetBonds()):
        raise Blocked("MISSING_BOND_ORDERS", f"{what} has bonds without an explicit order")


def load(text: str, fmt: str, template: str | None):
    """Return (mol, source decision text, decisions). Never perceives bond orders from geometry."""
    from rdkit import Chem

    decisions = []
    if fmt not in FORMATS:
        raise Blocked("UNSUPPORTED_FORMAT", f"ligand format {fmt!r} is not supported")
    if fmt in ("sdf", "mol"):
        blocks = [b for b in re.split(r"^\$\$\$\$[ \t]*$", text, flags=re.M) if b.strip()]
        if len(blocks) != 1:
            raise Blocked("MULTIPLE_LIGANDS" if blocks else "MALFORMED_INPUT", "ligand file must contain exactly one molecule")
        mol = Chem.MolFromMolBlock(blocks[0], sanitize=False, removeHs=False, strictParsing=True)
    elif fmt == "mol2":
        if text.count("@<TRIPOS>MOLECULE") != 1:
            raise Blocked("MULTIPLE_LIGANDS", "ligand file must contain exactly one molecule")
        mol = Chem.MolFromMol2Block(text, sanitize=False, removeHs=False)
    elif fmt == "smi":
        mol = Chem.MolFromSmiles(_first_smiles(text, "ligand"), sanitize=False)
    else:  # pdb: coordinates and connectivity only, no bond orders
        if template is None:
            raise Blocked("MISSING_BOND_ORDERS", "a PDB ligand has no bond orders; supply SDF/MOL2/SMILES or a SMILES bond-order template")
        mol = Chem.MolFromPDBBlock(text, sanitize=False, removeHs=False, proximityBonding=True)
    if mol is None:
        raise Blocked("MALFORMED_INPUT", "ligand could not be parsed")
    _check_atoms(mol, "ligand")
    if fmt == "pdb":
        from rdkit.Chem import AllChem

        tpl = Chem.MolFromSmiles(_first_smiles(template, "ligand template"))
        if tpl is None:
            raise Blocked("MALFORMED_INPUT", "ligand template SMILES could not be parsed")
        _check_atoms(tpl, "ligand template")
        n_sub = mol.GetNumAtoms()
        heavy = Chem.RWMol(mol)
        for idx in sorted((a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() == 1), reverse=True):
            heavy.RemoveAtom(idx)
        heavy = heavy.GetMol()
        if heavy.GetNumAtoms() != tpl.GetNumAtoms():
            raise Blocked("TEMPLATE_MISMATCH", f"template has {tpl.GetNumAtoms()} heavy atoms, ligand has {heavy.GetNumAtoms()}")
        try:
            heavy.UpdatePropertyCache(strict=False)
            mol = AllChem.AssignBondOrdersFromTemplate(tpl, heavy)
        except ValueError:
            raise Blocked("TEMPLATE_MISMATCH", "template connectivity does not match the ligand") from None
        # Hydrogen counts and formal charges come from the template only (PDB atoms carry no H semantics).
        match = mol.GetSubstructMatch(tpl)
        if len(match) != tpl.GetNumAtoms():
            raise Blocked("TEMPLATE_MISMATCH", "template does not map onto the ligand after bond-order assignment")
        rw = Chem.RWMol(mol)
        for ti, mi in enumerate(match):
            ta, ma = tpl.GetAtomWithIdx(ti), rw.GetAtomWithIdx(mi)
            ma.SetFormalCharge(ta.GetFormalCharge())
            ma.SetNumRadicalElectrons(0)
            ma.SetNoImplicit(True)
            ma.SetNumExplicitHs(ta.GetTotalNumHs())
        mol = rw.GetMol()
        try:
            Chem.SanitizeMol(mol)
        except Exception as e:
            raise Blocked("SANITIZE_FAILED", f"templated ligand chemistry is invalid: {type(e).__name__}") from None
        Chem.AssignStereochemistryFrom3D(mol)
        decisions.append(_decision("LIGAND_BOND_ORDERS", "bond orders and formal charges from the supplied SMILES template (submitted PDB hydrogens replaced by template hydrogens)", n_sub, mol.GetNumAtoms(), True))
    else:
        _check_bond_orders(mol, "ligand")
        try:
            Chem.SanitizeMol(mol)
        except Exception as e:  # RDKit raises several sanitize exception types
            raise Blocked("SANITIZE_FAILED", f"ligand chemistry is invalid: {type(e).__name__}") from None
        if mol.GetNumConformers() and mol.GetConformer().Is3D():
            Chem.AssignStereochemistryFrom3D(mol)
        decisions.append(_decision("LIGAND_BOND_ORDERS", f"explicit bond orders from the submitted {fmt.upper()} file", mol.GetNumAtoms(), mol.GetNumAtoms(), False))
    return mol, decisions


def _apply_dimorphite(mol, ph: float):
    from dimorphite_dl import protonate_smiles
    from rdkit import Chem

    heavy = Chem.RemoveHs(mol)
    out = sorted(protonate_smiles(Chem.MolToSmiles(heavy), ph_min=ph, ph_max=ph, max_variants=1))
    if not out:
        raise Blocked("TOOL_FAILED", "Dimorphite-DL returned no protonation state")
    dm = Chem.MolFromSmiles(out[0])
    if dm is None:
        raise Blocked("TOOL_FAILED", "Dimorphite-DL returned an unparseable state")

    def graph(m):
        g = Chem.RWMol(m)
        for a in g.GetAtoms():
            a.SetFormalCharge(0)
            a.SetIsAromatic(False)
            a.SetNoImplicit(True)
        for b in g.GetBonds():
            b.SetBondType(Chem.BondType.SINGLE)
            b.SetIsAromatic(False)
        return g.GetMol()

    match = graph(heavy).GetSubstructMatch(graph(dm))
    if len(match) != heavy.GetNumAtoms() or dm.GetNumAtoms() != heavy.GetNumAtoms():
        raise Blocked("TOOL_FAILED", "Dimorphite-DL state does not map onto the submitted ligand")
    rw = Chem.RWMol(heavy)
    for qi, ti in enumerate(match):
        a = rw.GetAtomWithIdx(ti)
        a.SetFormalCharge(dm.GetAtomWithIdx(qi).GetFormalCharge())
        a.SetNumExplicitHs(0)
        a.SetNoImplicit(False)
    try:
        Chem.SanitizeMol(rw)
    except Exception:
        raise Blocked("TOOL_FAILED", "Dimorphite-DL changed bonding; state not applied") from None
    return rw.GetMol(), out[0]


def prepare(text: str, fmt: str, template: str | None, opts: dict) -> dict:
    from rdkit import Chem
    from rdkit.Chem import AllChem

    mol, decisions = load(text, fmt, template)
    warnings: list[str] = []
    stages = []
    generated = False
    in_sha = sha256_text(text + ("\n#template\n" + template if template is not None else ""))
    has3d = mol.GetNumConformers() > 0 and mol.GetConformer().Is3D()
    n_before = mol.GetNumAtoms()
    h_before = sum(1 for a in mol.GetAtoms() if a.GetAtomicNum() == 1)
    tautomer = "AS_SUBMITTED"
    if opts["ligandProtonation"] == "DIMORPHITE_PREVIEW":
        mol, smi = _apply_dimorphite(mol, opts["pH"])
        generated = True
        tautomer = f"DIMORPHITE_DL_PH_{opts['pH']:.2f}"
        stages.append(stage("dimorphite_dl", tool_version("dimorphite_dl"), {"ph_min": round(opts["pH"], 2), "ph_max": round(opts["pH"], 2), "max_variants": 1},
                            in_sha, sha256_text(smi), ["LIGAND_PROTONATION"]))
        decisions.append(_decision("LIGAND_PROTONATION", f"Dimorphite-DL state at pH {opts['pH']:.2f} (PREVIEW_UNQUALIFIED); formal charge {Chem.GetFormalCharge(mol)}", n_before, mol.GetNumAtoms(), True))
    else:
        decisions.append(_decision("LIGAND_PROTONATION", f"keep submitted protonation and formal charge ({Chem.GetFormalCharge(mol)})", n_before, n_before, False))
    implicit = sum(a.GetTotalNumHs() - sum(1 for n in a.GetNeighbors() if n.GetAtomicNum() == 1) for a in mol.GetAtoms())
    before_h = mol.GetNumAtoms()
    mol = Chem.AddHs(mol, addCoords=has3d)
    h_added = max(0, sum(1 for a in mol.GetAtoms() if a.GetAtomicNum() == 1) - h_before)
    if implicit:
        decisions.append(_decision("LIGAND_HYDROGENS", f"{implicit} implicit hydrogens made explicit (valence model of the submitted chemistry)", before_h, mol.GetNumAtoms(), True))
    if mol.GetNumAtoms() > limits.MAX_LIGAND_ATOMS:
        raise Blocked("OVERSIZE_INPUT", f"ligand has more than {limits.MAX_LIGAND_ATOMS} atoms with hydrogens")
    embedded = False
    if not has3d:
        params = AllChem.ETKDGv3()
        params.randomSeed = ETKDG_SEED
        params.numThreads = 1
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise Blocked("EMBED_FAILED", "ETKDG could not generate 3D coordinates")
        embedded = True
        decisions.append(_decision("LIGAND_3D_EMBED", f"no 3D coordinates submitted; ETKDGv3 embedding (seed {ETKDG_SEED})", mol.GetNumAtoms(), mol.GetNumAtoms(), True))
    limits.require_finite([c for i in range(mol.GetNumAtoms()) for c in mol.GetConformer().GetAtomPosition(i)], "prepared ligand")
    # Canonical atom order (deterministic in the pinned RDKit) and no carried-over properties or names.
    ranks = list(Chem.CanonicalRankAtoms(mol, breakTies=True))
    mol = Chem.RenumberAtoms(mol, sorted(range(mol.GetNumAtoms()), key=lambda i: ranks[i]))
    for p in list(mol.GetPropNames()):
        mol.ClearProp(p)
    mol.SetProp("_Name", "ligand")
    sdf = Chem.MolToMolBlock(mol) + "$$$$\n"
    stages.append(stage("rdkit.ligand", tool_version("rdkit"), {"format": fmt, "template": template is not None, "addHs": True, "etkdg": embedded, "etkdg_seed": ETKDG_SEED, "canonical_order": True},
                        in_sha, sha256_text(sdf), [d["key"] for d in decisions]))

    from meeko import MoleculePreparation, PDBQTWriterLegacy

    try:
        setups = MoleculePreparation(charge_model="gasteiger").prepare(mol)
    except Exception as e:
        raise Blocked("TOOL_FAILED", f"Meeko could not prepare the ligand: {limits.scrub(str(e))[:300]}") from None
    if len(setups) != 1:
        raise Blocked("TOOL_FAILED", "Meeko produced more than one ligand setup")
    pdbqt, ok, err = PDBQTWriterLegacy.write_string(setups[0])
    if not ok:
        raise Blocked("TOOL_FAILED", f"Meeko PDBQT writer failed: {limits.scrub(err)[:300]}")
    m = re.search(r"^TORSDOF\s+(\d+)", pdbqt, flags=re.M)
    torsions = int(m.group(1)) if m else 0
    if torsions > 100:
        raise Blocked("TOO_FLEXIBLE", "ligand has more than 100 rotatable bonds")
    decisions.append(_decision("LIGAND_CHARGES", "Gasteiger partial charges (Meeko)", mol.GetNumAtoms(), mol.GetNumAtoms(), False))
    decisions.append(_decision("LIGAND_TORSIONS", f"{torsions} rotatable bonds (Meeko default rules; amides rigid)", mol.GetNumAtoms(), mol.GetNumAtoms(), False))
    stages.append(stage("meeko.ligand", tool_version("meeko"), {"charge_model": "gasteiger", "merge_these_atom_types": "H", "flexible_amides": False},
                        sha256_text(sdf), sha256_text(pdbqt), ["LIGAND_CHARGES", "LIGAND_TORSIONS"]))
    conf = mol.GetConformer()
    order = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3, Chem.BondType.AROMATIC: 1.5}
    canonical = {
        "schemaVersion": 1, "subject": "ligand", "smiles": Chem.MolToSmiles(Chem.RemoveHs(mol)),
        "atoms": [{"i": a.GetIdx(), "element": a.GetSymbol(), "formalCharge": a.GetFormalCharge(), "aromatic": a.GetIsAromatic(),
                   "x": round(conf.GetAtomPosition(a.GetIdx()).x, 4), "y": round(conf.GetAtomPosition(a.GetIdx()).y, 4), "z": round(conf.GetAtomPosition(a.GetIdx()).z, 4)}
                  for a in mol.GetAtoms()],
        "bonds": [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": order.get(b.GetBondType(), 0)} for b in mol.GetBonds()],
        "rotatableBonds": torsions, "chargesRef": "ligand.pdbqt",
    }
    if any(b["order"] == 0 for b in canonical["bonds"]):
        raise Blocked("MISSING_BOND_ORDERS", "prepared ligand has a bond without an explicit order")
    return {
        "decisions": decisions, "warnings": warnings, "stages": stages, "generated": generated, "tautomer": tautomer,
        "pdbqt": pdbqt, "sdf": sdf, "canonical": canonical, "atoms": mol.GetNumAtoms(), "hAdded": h_added,
        "formalCharge": Chem.GetFormalCharge(mol), "embedded": embedded, "torsions": torsions,
    }
