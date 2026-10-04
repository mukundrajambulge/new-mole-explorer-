# Linux runtime record

## Platform

- Authorized environment: existing WSL2 distribution `Ubuntu-24.04`, Ubuntu 24.04.5 LTS (Noble), x86-64.
- Kernel: `6.6.87.2-microsoft-standard-WSL2`; glibc `2.39` (`2.39-0ubuntu8.9`). The selected RDKit/NumPy/Pillow wheels require manylinux glibc no newer than the recorded floor; this runtime exceeds that floor.
- Runtime was provisioned under `/root/.local/share/mole-explorer/d3-closure-exec-01-linux/`; Python, venv, wheelhouse, and build logs are outside the Git checkout. The Windows security policy was not modified.
- CPython was built from the official Python 3.13.16 source archive into a private prefix with `--with-ensurepip=install`, then isolated in a private venv. The Python executable SHA-256 is `e382ab092de7936425dbfa2af85ad78a174de551effbf37b83b8627e78ed6c1c`.
- Runtime reports CPython `3.13.16`, GCC `13.3.0`, OpenSSL `3.0.13`, machine `x86_64`. The dedicated venv imports all of `rdkit.rdBase`, `rdkit.Chem`, `rdkit.Chem.rdmolfiles`, and `rdkit.Chem.rdmolops`.

## Pinned packages

| Package | Exact Linux artifact/version | SHA-256 |
|---|---|---|
| RDKit | `rdkit-2026.3.6-cp313-cp313-manylinux_2_28_x86_64.whl` | `3d0a2011c2a46f312010c8d8ec89b8210795663285545b2ac0909d1b9551fe41` |
| NumPy | `numpy-2.3.3-cp313-cp313-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` | `5b83648633d46f77039c29078751f80da65aa64d5622a3cd62aaef9d835b6c93` |
| Pillow | `pillow-12.0.0-cp313-cp313-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` | `f4f1231b7dec408e8670264ce63e9c71409d9583dd21d32c163e25213ee2a344` |
| pip | `pip-25.2-py3-none-any.whl` | `6d67a2b4e7f14d8b31b8b52648866fa717f45a1eb70e83002f4331d07e953717` |

The Python source archive SHA-256 is `f4b1bfb3c79b5bb11b8d228a12504163b4c0dab4d679828d8f5f26b6cb6ab35d`. PyPI JSON artifact digests and downloaded wheel digests matched. Wheels were installed offline with `--no-index --no-deps --require-hashes`; no dependency resolution or network access occurred during runtime package installation. Exact requirement and bootstrap locks, artifact inventory, and install transcript are retained under the private runtime path and will be copied into this package's logs.

The Linux RDKit wheel's embedded metadata identifies the distribution as PyPI `rdkit` but attributes wheel packaging to `kuelumbus/rdkit-pypi` (Christopher Kuenneth). The downloaded wheel hash was matched to official PyPI file metadata; the build is not characterized as upstream-signed. The RDKit version and API semantics were checked independently against the upstream `Release_2026_03_6` tag/commit. The full distribution metadata, WHEEL tags and installed-extension RECORD hash checks are preserved in `runtime_logs/linux/runtime-identity.json`.

## Runtime verification

Observed in the private venv: Python `3.13.16`; RDKit distribution metadata `2026.3.6`; `rdBase.rdkitVersion` `2026.03.6`; NumPy `2.3.3`; Pillow `12.0.0`; pip `25.2`. The exact `rdBase.so`, `rdmolfiles.so`, and `rdmolops.so` hashes match their installed RDKit wheel `RECORD` entries. Loaded module paths are under the private venv's `lib/python3.13/site-packages/rdkit/` tree.

Build dependencies were installed only inside the existing Ubuntu distribution to build CPython from its exact official source archive. Exact installed package versions and build logs are retained under the private runtime; selected transcripts/manifests are copied into `runtime_logs/linux/`. The isolated Python environment and ~90 MB wheelhouse stay out of Git.

## Environment for scientific runs

Run from the repository worktree mounted into WSL at `/mnt/c/Users/mukun/.codex/worktrees/d3-closure-exec-01-9814/molecular-workstation`, using the task venv's absolute Python path with `-I`, `TZ=UTC`, `LC_ALL=C`, a clean stdout/stderr capture, and no external service or GPU. Each run records timestamps, command arguments, environment, source/profile/driver digests, and package identities. The preparation tool operates single-process without RNG.
