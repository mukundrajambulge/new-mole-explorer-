"""Capture the existing task-local WSL runtime identity and package RECORD hashes."""

from __future__ import annotations

import hashlib
import base64
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import sysconfig
import zipfile
from pathlib import Path

import PIL
import numpy
import rdkit
import rdkit.Chem
import rdkit.Chem.rdmolfiles
import rdkit.Chem.rdmolops
from rdkit import rdBase


BASE = Path("/root/.local/share/mole-explorer/d3-closure-exec-01-linux")


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_record(dist: importlib.metadata.Distribution, package_path: str) -> dict[str, str | None]:
    match = next(item for item in dist.files or [] if str(item).replace("\\", "/") == package_path)
    path = Path(dist.locate_file(match))
    observed = sha(path)
    record_value = match.hash.value if match.hash else None
    record_digest = None
    if record_value:
        record_digest = base64.urlsafe_b64decode(record_value + "=" * (-len(record_value) % 4)).hex()
        if record_digest != observed:
            raise ValueError(f"installed extension differs from wheel RECORD: {package_path}")
    return {"path": str(path), "sha256": observed, "recordHash": f"sha256={record_value}" if record_value else None, "recordSha256Hex": record_digest}


def main() -> None:
    dist = importlib.metadata.distribution("rdkit")
    wheel_path = BASE / "artifacts" / "rdkit-2026.3.6-cp313-cp313-manylinux_2_28_x86_64.whl"
    with zipfile.ZipFile(wheel_path) as wheel:
        wheel_metadata = wheel.read("rdkit-2026.3.6.dist-info/METADATA").decode("utf-8")
        wheel_tag = wheel.read("rdkit-2026.3.6.dist-info/WHEEL").decode("utf-8")
    apt_packages = [
        "build-essential", "gcc", "g++", "make", "pkg-config", "libssl-dev", "zlib1g-dev",
        "libbz2-dev", "libreadline-dev", "libsqlite3-dev", "libffi-dev", "liblzma-dev",
        "libncurses-dev", "libncursesw6", "libgdbm-dev", "libgdbm-compat-dev", "libexpat1-dev",
        "uuid-dev", "ca-certificates", "libc6",
    ]
    apt = subprocess.run(["dpkg-query", "-W", "-f=${binary:Package}=${Version}\\n", *apt_packages], check=False, text=True, capture_output=True)
    apt_versions = sorted(line for line in apt.stdout.splitlines() if line)
    identity = {
        "timestamp_utc": subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], check=True, text=True, capture_output=True).stdout.strip(),
        "distribution": Path("/etc/os-release").read_text(encoding="utf-8"),
        "kernel": platform.uname()._asdict(),
        "architecture": platform.machine(),
        "glibc": platform.libc_ver(),
        "python": {
            "version": sys.version,
            "implementation": platform.python_implementation(),
            "executable": sys.executable,
            "executable_sha256": sha(Path(sys.executable).resolve()),
            "prefix": sys.prefix,
            "compiler": platform.python_compiler(),
            "openssl": __import__("ssl").OPENSSL_VERSION,
            "sysconfig": {key: sysconfig.get_config_var(key) for key in ("SOABI", "CONFIG_ARGS", "CC", "CFLAGS", "LDFLAGS", "MULTIARCH")},
        },
        "packages": {
            "rdkit_distribution_version": importlib.metadata.version("rdkit"),
            "rdkit_runtime_version": rdBase.rdkitVersion,
            "numpy": numpy.__version__,
            "pillow": PIL.__version__,
            "pip": importlib.metadata.version("pip"),
            "rdkit_wheel": {"filename": wheel_path.name, "sha256": sha(wheel_path), "wheelMetadata": wheel_metadata, "wheelTag": wheel_tag},
            "rdkit_native_extensions": {
                "rdBase": file_record(dist, "rdkit/rdBase.so"),
                "rdmolfiles": file_record(dist, "rdkit/Chem/rdmolfiles.so"),
                "rdmolops": file_record(dist, "rdkit/Chem/rdmolops.so"),
            },
            "module_paths": {
                module.__name__: module.__file__
                for module in (rdkit.rdBase, rdkit.Chem, rdkit.Chem.rdmolfiles, rdkit.Chem.rdmolops)
            },
        },
        "build_dependencies": {"packages": apt_versions, "dpkg_query_returncode": apt.returncode, "dpkg_query_stderr": apt.stderr},
        "source_artifact": {"path": str(BASE / "artifacts" / "Python-3.13.16.tar.xz"), "sha256": sha(BASE / "artifacts" / "Python-3.13.16.tar.xz")},
        "environment": {name: os.environ.get(name) for name in ("TZ", "LC_ALL", "LANG", "PYTHONHASHSEED")},
    }
    print(json.dumps(identity, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
