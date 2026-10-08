"""Launcher for `python -I` (isolated mode puts neither cwd nor the script dir on sys.path)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mole_prep.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
