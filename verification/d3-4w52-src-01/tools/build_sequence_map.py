"""Reconcile the current 4W52 deposited polymer against UniProt P00720."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
entity = json.loads((ROOT / "source_artifacts/rcsb_api/polymer_entity_4w52_1.json").read_text(encoding="utf-8"))
uniprot = json.loads((ROOT / "source_artifacts/uniprot/P00720_current.json").read_text(encoding="utf-8"))
coordinate_audit = json.loads((ROOT / "source_artifacts/derived/4W52_coordinate_audit.json").read_text(encoding="utf-8"))
deposited = entity["entity_poly"]["pdbx_seq_one_letter_code_can"]
reference = uniprot["sequence"]["value"]
modeled_positions = set(coordinate_audit["protein_auth_residue_numbers"])
three = dict(zip("ACDEFGHIKLMNPQRSTVWY", "ALA CYS ASP GLU PHE GLY HIS ILE LYS LEU MET ASN PRO GLN ARG SER THR VAL TRP TYR".split()))
known = {
    12: "R12G; deposited mmCIF sequence discrepancy labeled variant by wwPDB validation; physical origin not stated in the 2015 paper",
    99: "L99A; deposited mmCIF sequence discrepancy labeled engineered mutation by wwPDB validation",
    137: "I137R; deposited mmCIF sequence discrepancy labeled variant by wwPDB validation; physical origin not stated in the 2015 paper",
}
rows = []
for position, aa in enumerate(deposited, 1):
    ref = reference[position - 1] if position <= len(reference) else "-"
    if position in known:
        status = known[position]
    elif position > len(reference):
        status = "Expression tag; classified as such by current wwPDB validation"
    else:
        status = "Same residue as current UniProt P00720 sequence"
    if position == 164:
        terminal = "Last modeled coordinate residue; not a justified physical C terminus if tag was retained"
    elif position == 172:
        terminal = "Last deposited sequence residue; physical terminal position only if tag was retained"
    elif position > len(reference):
        terminal = "Unmodeled deposited expression-tag residue"
    else:
        terminal = "Internal polymer position"
    rows.append({
        "sequence_position": position,
        "deposited_residue_1letter": aa,
        "deposited_residue_3letter": three[aa],
        "uniprot_P00720_reference_1letter": ref,
        "coordinate_residue_present": "yes" if position in modeled_positions else "no",
        "variant_mutation_or_tag_status": status,
        "terminal_relevance": terminal,
    })

assert len(deposited) == 172
assert len(reference) == 164
assert {r["sequence_position"] for r in rows if r["deposited_residue_1letter"] != r["uniprot_P00720_reference_1letter"] and r["sequence_position"] <= len(reference)} == {12, 99, 137}
assert modeled_positions == set(range(1, 165))
out = ROOT / "SEQUENCE_POSITION_MAP.csv"
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
print(json.dumps({"deposited_length": len(deposited), "UniProt_length": len(reference), "coordinates_positions": [min(modeled_positions), max(modeled_positions), len(modeled_positions)], "differences": [(r["sequence_position"], r["uniprot_P00720_reference_1letter"], r["deposited_residue_1letter"]) for r in rows if r["sequence_position"] <= len(reference) and r["deposited_residue_1letter"] != r["uniprot_P00720_reference_1letter"]], "tag": deposited[164:], "csv": str(out.relative_to(ROOT))}, indent=2))
