#!/usr/bin/env bash
# Regenerate workers/prep/requirements.lock.txt (transitive, hashed) from requirements.in, prove it
# installs with --require-hashes into a fresh venv, and print each direct tool's licence metadata.
# Run in WSL Ubuntu-24.04 from the repo root; needs network. Then review the diff and update TOOLS.md.
set -euo pipefail
rm -rf ~/mole-lock && python3 -m venv ~/mole-lock && . ~/mole-lock/bin/activate
pip install -q --upgrade pip pip-tools
pip-compile --quiet --generate-hashes --allow-unsafe --strip-extras --no-header \
  --output-file workers/prep/requirements.lock.txt workers/prep/requirements.in
pip install -q --require-hashes -r workers/prep/requirements.lock.txt
python - <<'PY'
from importlib.metadata import metadata
for p in ["rdkit", "meeko", "dimorphite_dl", "pdb2pqr", "propka", "pdbfixer", "openmm", "scipy", "gemmi"]:
    m = metadata(p)
    lic = m.get("License-Expression") or (m.get("License") or "").splitlines()[0:1]
    cls = [c.split(" :: ")[-1] for c in m.get_all("Classifier") or [] if c.startswith("License ::")]
    print(f"{m['Name']}=={m['Version']} | license={lic} | classifiers={cls}")
PY
