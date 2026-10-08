#!/usr/bin/env bash
# Regenerate workers/prep/requirements.lock.txt (transitive, hashed) from requirements.in.
# Run in WSL Ubuntu-24.04 from the repo root; needs network. Then review the diff and update TOOLS.md.
set -euo pipefail
python3 -m venv ~/mole-lock && . ~/mole-lock/bin/activate
pip install -q --upgrade pip pip-tools
pip-compile --generate-hashes --allow-unsafe --strip-extras --no-header \
  --output-file workers/prep/requirements.lock.txt workers/prep/requirements.in
# Licences to record in native/third_party/TOOLS.md (verify, do not assume):
pip install -q --require-hashes -r workers/prep/requirements.lock.txt
for p in rdkit meeko dimorphite_dl pdb2pqr propka pdbfixer; do pip show "$p" | grep -E '^(Name|Version|License)'; done
