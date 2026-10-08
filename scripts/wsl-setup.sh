#!/usr/bin/env bash
# Run inside WSL Ubuntu 24.04:  wsl -d Ubuntu-24.04  then  bash scripts/wsl-setup.sh
# Installs the native toolchain, Docker, AutoDock Vina 1.2.7 and the Python preparation environment.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
sudo apt-get update
sudo apt-get install -y build-essential cmake ninja-build git curl unzip python3-venv python3-pip docker.io
sudo usermod -aG docker "$USER"
grep -q "systemd=true" /etc/wsl.conf 2>/dev/null || printf "[boot]\nsystemd=true\n" | sudo tee -a /etc/wsl.conf

mkdir -p ~/mole-tools && cd ~/mole-tools
# Check the exact asset name on https://github.com/ccsb-scripps/AutoDock-Vina/releases/tag/v1.2.7
curl -fL -o vina "https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_linux_x86_64"
chmod +x vina
echo "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644  vina" | sha256sum -c -   # must match native/third_party/TOOLS.md

python3 -m venv ~/mole-prep
. ~/mole-prep/bin/activate
pip install --upgrade pip
# Reproducible install from the hashed lock (regenerate with scripts/lock-prep.sh)
pip install --require-hashes -r "$REPO/workers/prep/requirements.lock.txt"
pip install pytest
echo "Done. Close all WSL windows and run 'wsl --shutdown' once so systemd and the docker group take effect."
