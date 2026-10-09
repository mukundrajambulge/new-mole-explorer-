"""Launcher for `python -I` (task R.1 smoke redock helpers): redock_smoke.py start|rmsd, cwd = job directory."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mole_prep.redock_smoke import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
