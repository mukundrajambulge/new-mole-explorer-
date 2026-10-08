"""Input caps, element allow-lists, path confinement and process hardening for the prep worker."""
from __future__ import annotations

import math
import os
import socket

MAX_INPUT_BYTES = 20 * 1024 * 1024
MAX_RECEPTOR_ATOMS = 200_000
MAX_LIGAND_ATOMS = 5_000
MAX_DIAGNOSTIC_CHARS = 480
STAGE_TIMEOUT_S = 120

# Elements Meeko/Vina can type for a ligand (no metals, no B/Si/Se in the interim profile).
LIGAND_ELEMENTS = frozenset({"H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I"})
# Standard polymer residues only (hetero groups are removed and listed in the plan).
RECEPTOR_ELEMENTS = frozenset({"H", "C", "N", "O", "S"})
PROTEIN_RESIDUES = frozenset(
    "ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL "
    "HID HIE HIP HSD HSE HSP CYX CYM ASH GLH LYN ARN ACE NME".split()
)
WATER_RESIDUES = frozenset({"HOH", "WAT", "H2O", "DOD", "TIP", "TIP3", "SOL"})


class Blocked(Exception):
    """A deterministic, user-facing refusal. code is stable; message has no absolute paths."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message

    def diagnostic(self) -> str:
        return scrub(f"{self.code}: {self.message}")


def scrub(text: str) -> str:
    """Remove absolute paths and cap length (errors must never leak host paths)."""
    out = []
    for tok in str(text).replace("\r", " ").replace("\n", " ").split(" "):
        if tok.startswith("/") or (len(tok) > 2 and tok[1] == ":" and tok[2] in "\\/") or "\\" in tok:
            tok = "<path>"
        out.append(tok)
    s = " ".join(out)
    return s[:MAX_DIAGNOSTIC_CHARS]


def require_finite(values, what: str) -> None:
    for v in values:
        if not math.isfinite(v):
            raise Blocked("NON_FINITE_COORDINATES", f"{what} contains NaN or Inf coordinates")


def confined(root: str, rel: str) -> str:
    """Resolve rel inside root; reject absolute paths, traversal and symlink escapes."""
    if not isinstance(rel, str) or not rel or rel.startswith("/") or "\\" in rel or ":" in rel:
        raise Blocked("PATH_REJECTED", "input path must be relative to the job directory")
    if any(part in ("", ".", "..") for part in rel.split("/")):
        raise Blocked("PATH_REJECTED", "input path must not contain empty, '.' or '..' segments")
    root_real = os.path.realpath(root)
    full = os.path.realpath(os.path.join(root_real, rel))
    if os.path.commonpath([root_real, full]) != root_real:
        raise Blocked("PATH_REJECTED", "input path escapes the job directory")
    return full


def read_capped(path: str, what: str) -> bytes:
    if not os.path.isfile(path):
        raise Blocked("INPUT_MISSING", f"{what} file not found")
    if os.path.getsize(path) > MAX_INPUT_BYTES:
        raise Blocked("OVERSIZE_INPUT", f"{what} exceeds {MAX_INPUT_BYTES} bytes")
    with open(path, "rb") as f:
        data = f.read(MAX_INPUT_BYTES + 1)
    if len(data) > MAX_INPUT_BYTES:
        raise Blocked("OVERSIZE_INPUT", f"{what} exceeds {MAX_INPUT_BYTES} bytes")
    return data


def decode_ascii(data: bytes, what: str) -> str:
    try:
        return data.decode("ascii")
    except UnicodeDecodeError:
        raise Blocked("MALFORMED_INPUT", f"{what} is not plain ASCII text") from None


def harden_process() -> None:
    """No network for any tool (Meeko can try to fetch CCD templates); single-threaded numerics."""

    def _deny(*_a, **_k):
        raise OSError("network access is disabled in the prep worker")

    socket.socket.connect = _deny  # type: ignore[method-assign]
    socket.socket.connect_ex = _deny  # type: ignore[method-assign]
    socket.create_connection = _deny  # type: ignore[assignment]
    socket.getaddrinfo = _deny  # type: ignore[assignment]
    for k in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "OPENMM_CPU_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[k] = "1"


REQUIRED_ENV = {"PYTHONHASHSEED": "0"}


def check_determinism_env() -> None:
    for k, v in REQUIRED_ENV.items():
        if os.environ.get(k) != v:
            raise Blocked("DETERMINISM_ENV", f"{k} must be {v}")
