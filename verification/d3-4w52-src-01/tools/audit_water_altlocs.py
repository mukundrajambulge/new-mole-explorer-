"""Read-only audit of alternate-location water atoms near 4W52/BNZ."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYZER = ROOT / "tools" / "analyze_4w52.py"
OUT = ROOT / "source_artifacts" / "derived" / "4W52_water_altloc_audit.json"

spec = importlib.util.spec_from_file_location("analyze_4w52", ANALYZER)
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load the coordinate parser")
module = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(module)

by_site = defaultdict(list)
for water in module.waters:
    key = (water["_atom_site.auth_asym_id"], water["_atom_site.auth_seq_id"], water["_atom_site.label_comp_id"])
    by_site[key].append(water)

sites = []
for key, rows in sorted(by_site.items(), key=lambda item: int(item[0][1])):
    states = []
    for water in rows:
        d_lig, lig_atom, _ = module.minimum(module.ligand, [water])
        d_prot, prot_atom, _ = module.minimum(module.protein, [water])
        states.append({
            "alt_id": water.get("_atom_site.label_alt_id", "."),
            "occupancy": float(water["_atom_site.occupancy"]),
            "distance_to_BNZ_A": round(d_lig, 3),
            "nearest_BNZ_atom": lig_atom.get("_atom_site.auth_atom_id"),
            "distance_to_nearest_protein_A": round(d_prot, 3),
            "nearest_protein_atom": ":".join(prot_atom.get("_atom_site." + field, "?") for field in ("auth_seq_id", "auth_comp_id", "auth_atom_id")),
            "within_5A_of_BNZ": d_lig <= 5,
            "within_8A_of_BNZ": d_lig <= 8,
        })
    sites.append({"auth_asym_id": key[0], "auth_seq_id": key[1], "component": key[2], "states": states})

alternates = [site for site in sites if any(state["alt_id"] not in {".", "?"} for state in site["states"])]
result = {
    "source_file": "source_artifacts/cif/4W52_current.cif",
    "water_residue_count": len(sites),
    "water_sites_with_altloc_records": len(alternates),
    "alternate_water_states_within_5A_of_BNZ": sum(state["within_5A_of_BNZ"] for site in alternates for state in site["states"]),
    "alternate_water_states_within_8A_of_BNZ": sum(state["within_8A_of_BNZ"] for site in alternates for state in site["states"]),
    "nearest_water_site": min(sites, key=lambda site: min(state["distance_to_BNZ_A"] for state in site["states"])) if sites else None,
    "alternate_water_sites": alternates,
}
OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: result[k] for k in ("water_residue_count", "water_sites_with_altloc_records", "alternate_water_states_within_5A_of_BNZ", "alternate_water_states_within_8A_of_BNZ", "nearest_water_site")}, indent=2))
