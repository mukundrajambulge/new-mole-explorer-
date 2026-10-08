# The locked prep environment must import every tool the pipeline calls (catches undeclared deps,
# e.g. Meeko needs scipy and gemmi but does not declare them).
import importlib

import pytest


@pytest.mark.parametrize("mod", ["rdkit", "meeko", "dimorphite_dl", "pdb2pqr", "propka", "pdbfixer", "openmm"])
def test_tool_imports(mod):
    importlib.import_module(mod)


def test_meeko_prep_api_available():
    from meeko import MoleculePreparation, PDBQTWriterLegacy  # noqa: F401
