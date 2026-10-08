# workers/prep lock

`requirements.in` holds exact pins of the direct dependencies (observed in ~/mole-prep on 2026-10-08).
`requirements.lock.txt` must become the full transitive `pip freeze` of that environment. Regenerate in WSL:

    . ~/mole-prep/bin/activate && pip freeze > workers/prep/requirements.lock.txt

Rebuild: `python3 -m venv ~/mole-prep && ~/mole-prep/bin/pip install -r workers/prep/requirements.lock.txt`.
