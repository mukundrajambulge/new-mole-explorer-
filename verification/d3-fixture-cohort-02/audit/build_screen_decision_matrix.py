"""Build the cohort disposition matrix from the retained 28-entry exact RTL query."""

from __future__ import annotations

import csv
from pathlib import Path

root = Path(__file__).parents[1]
source = root / "COHORT_SOURCE_TRACTABILITY_MATRIX.csv"
target = root / "COHORT_SCREEN_DECISION_MATRIX.csv"

deep = {"5LJB", "1KT5", "1GX8", "6PY0", "9I7O"}
detailed = {
    "5HBS", "5H8T", "1KQW", "1AQB", "1HBP", "4QZT", "9I7N", "1FMJ", "1RBP", "1CRB",
}

reasons = {
    "5LJB": "Deep finalist; high-resolution human CRBP1, but recombinant construct/source detail is less direct and structured-water/contact context needs exclusion under dry-profile review.",
    "1KT5": "Deep finalist; source-complete natural bovine plasma RBP, but primary study describes a retinol-associated water/H-bond network incompatible with CORE_DRY_V1.",
    "1GX8": "Deep finalist; natural bovine beta-lactoglobulin, but low-resolution model has major validation concerns, ligand/side-chain alternate states, and a biological dimer mate near the ligand site.",
    "6PY0": "Deep finalist; retinol is fully occupied, but the deposited construct is recombinant/tag-cleaved mouse SAA3, the trimer is the relevant assembly, and an internal binding-loop segment (73-74) is unresolved.",
    "9I7O": "Selected source-resolved candidate; natural bovine milk beta-lactoglobulin A/B mixture, author-designated monomer, complete RTL, supported CORE_DRY_V1 atom types. Carry forward the natural mixture, missing mature Leu17/AEPE loop, and PDB pH 7.4 versus paper pH 8.5 discrepancy explicitly.",
    "5HBS": "Detailed screen; human CRBP1 is an engineered E. coli construct with 14 protein alternate-location residues; no source advantage over the selected natural candidate.",
    "5H8T": "Detailed screen; human CRBP1 is an engineered E. coli construct with 8 protein alternate-location residues; no source advantage over the selected natural candidate.",
    "1KQW": "Detailed screen; zebrafish cellular retinol-binding protein is a non-target species/construct and RTL has a refined occupancy series from 0.06 to 1.00.",
    "1AQB": "Detailed screen; natural pig plasma RBP has 3 protein alternate-location residues and a bound cadmium component; not the selected target context.",
    "1HBP": "Detailed screen; bovine plasma RBP has an eight-residue coordinate gap and an incomplete primary-source citation; more tractable representative 1KT5 was examined in depth.",
    "4QZT": "Detailed screen; engineered human CRBPII contains multiple RTL instances with differing occupancies and acetate components, complicating a single explicit receptor/ligand state.",
    "9I7N": "Detailed paired comparator to 9I7O from the same natural beta-lactoglobulin study; lower RTL occupancy (0.598), broader unresolved sequence (including mature N terminus and internal loop), so 9I7O is the stronger deposited state.",
    "1FMJ": "Detailed screen; retinol is in an enzyme active-site complex that also contains PAP-derived ligand and multiple mercury atoms; not a simple retinol-carrier fixture.",
    "1RBP": "Detailed screen; human plasma RBP entry has seven unresolved C-terminal positions and less direct natural-source documentation than the intact candidate contexts.",
    "1CRB": "Detailed screen; rat cellular retinol-binding protein is a non-target species and the structure contains cadmium components.",
    "1KT6": "Fast exclude; redundant bovine plasma-RBP pH-series entry with eight unresolved deposited positions; the source-complete mature-state comparator 1KT5 was retained for detailed review.",
    "1KT7": "Fast exclude; redundant bovine plasma-RBP pH-series entry with eight unresolved deposited positions; the source-complete mature-state comparator 1KT5 was retained for detailed review.",
    "1KT3": "Fast exclude; redundant bovine plasma-RBP pH-series entry with eight unresolved deposited positions; the source-complete mature-state comparator 1KT5 was retained for detailed review.",
    "1KT4": "Fast exclude; redundant bovine plasma-RBP pH-series entry with eight unresolved deposited positions; the source-complete mature-state comparator 1KT5 was retained for detailed review.",
    "4QYN": "Fast exclude; engineered human CRBPII model has two retinol-bound chains plus an acetate component; more interpretable paired entry 4QZT was retained for detailed review.",
    "2RCT": "Fast exclude; engineered human CRBPII has multiple partial/full retinol occupancies and sulfate/TLA components that complicate a single ligand state.",
    "5LJE": "Fast exclude; engineered human CRBP1 K40L/Q108L mutant alters retinol-contact residues and includes a bound sodium component.",
    "5LJC": "Fast exclude; engineered human CRBP1 K40L mutant has split retinol occupancy (0.47/0.53) and a bound sodium component.",
    "5LJD": "Fast exclude; engineered human CRBP1 K40L mutant changes a retinol-contact residue and includes a bound sodium component.",
    "4QZU": "Fast exclude; engineered human CRBPII contains several RTL instances with mixed occupancies and multiple acetate/glycerol components.",
    "5NU7": "Fast exclude; natural human plasma RBP4 has seven unresolved C-terminal positions and a bound chloride component; not more source-complete than the retained RBP comparator.",
    "1BRP": "Fast exclude; older human plasma RBP4 entry with seven unresolved C-terminal positions and 2.5 A resolution; lower source/coordinate completeness than later entries.",
    "1IIU": "Fast exclude; natural chicken plasma RBP is a different species and has a bound cadmium component.",
}

with source.open(newline="", encoding="utf-8-sig") as stream:
    rows = list(csv.DictReader(stream))

assert len(rows) == 28, f"Expected 28 exact-query hits, got {len(rows)}"
entry_ids = {row["pdb_id"] for row in rows}
assert len(entry_ids) == 28, "Exact-query result contains duplicate identifiers"
assert set(reasons) == entry_ids, "Every exact-query hit must have exactly one disposition rationale"
assert len(deep) == 5 and len(detailed) == 10, "Unexpected detailed/finalist cohort sizes"
assert deep | detailed <= entry_ids, "A detailed or finalist entry is absent from the query results"
assert not (deep & detailed)

with target.open("w", newline="", encoding="utf-8") as stream:
    fields = ["pdb_id", "screen_stage", "detailed_screen_included", "decision_rationale", "rcsb_entry_url", "coordinate_url", "primary_source_url"]
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        pdb_id = row["pdb_id"]
        stage = "DEEP_FINALIST" if pdb_id in deep else "DETAILED_SCREEN" if pdb_id in detailed else "FAST_EXCLUDE"
        writer.writerow({
            "pdb_id": pdb_id,
            "screen_stage": stage,
            "detailed_screen_included": "yes" if stage != "FAST_EXCLUDE" else "no",
            "decision_rationale": reasons[pdb_id],
            "rcsb_entry_url": row["rcsb_entry_url"],
            "coordinate_url": row["coordinate_url"],
            "primary_source_url": row["primary_source_url"],
        })
