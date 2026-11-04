#!/usr/bin/env bash
# Builds the rdsops wheel at the commit pinned in RDSOPS_REF, into build/rdsops/.
# The game always ships a known version of the real rules engine.
set -euo pipefail
cd "$(dirname "$0")/.."
REF=$(tr -d '[:space:]' < RDSOPS_REF)
SRC=build/rds-geodatabase-ops
rm -rf build/rdsops "$SRC"
mkdir -p build/rdsops
git clone --quiet https://github.com/iDan-Armstrong/rds-geodatabase-ops "$SRC"
git -C "$SRC" checkout --quiet "$REF"
python3 -m pip wheel --quiet --no-deps "$SRC" -w build/rdsops
ls build/rdsops
