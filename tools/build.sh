#!/usr/bin/env bash
# Packages the add-on:
#   dist/SpeedrunAcademy.mcaddon  - behavior + resource pack together (double-click to import both)
#   dist/SpeedrunAcademy_BP.mcpack / _RP.mcpack - the packs individually
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/stage
cp -r behavior_pack dist/stage/SpeedrunAcademy_BP
cp -r resource_pack dist/stage/SpeedrunAcademy_RP
(cd dist/stage && zip -qr ../SpeedrunAcademy.mcaddon SpeedrunAcademy_BP SpeedrunAcademy_RP)
(cd behavior_pack && zip -qr ../dist/SpeedrunAcademy_BP.mcpack .)
(cd resource_pack && zip -qr ../dist/SpeedrunAcademy_RP.mcpack .)
rm -rf dist/stage
echo "Built dist/SpeedrunAcademy.mcaddon (+ individual .mcpack files)"
