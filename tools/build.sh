#!/usr/bin/env bash
# Packages the behavior pack into dist/SpeedrunAcademy.mcpack (double-click to import into Minecraft).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
(cd behavior_pack && zip -qr ../dist/SpeedrunAcademy.mcpack .)
echo "Built dist/SpeedrunAcademy.mcpack"
