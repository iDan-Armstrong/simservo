#!/usr/bin/env bash
# Builds a real tool's wheel at the commit pinned in its *_REF file, into build/<pkg>/.
# The game always ships known versions of the real rules engines.
#   tools/fetch-rdsops.sh            rdsops  from rds-geodatabase-ops at RDSOPS_REF
#   tools/fetch-rdsops.sh egisops    egisops from arcgis-enterprise-ops at EGISOPS_REF
set -euo pipefail
cd "$(dirname "$0")/.."
PKG=${1:-rdsops}
case "$PKG" in
  rdsops)  REPO=rds-geodatabase-ops;   REF_FILE=RDSOPS_REF ;;
  egisops) REPO=arcgis-enterprise-ops; REF_FILE=EGISOPS_REF ;;
  *) echo "unknown package $PKG" >&2; exit 2 ;;
esac
REF=$(tr -d '[:space:]' < "$REF_FILE")
SRC=build/$REPO
rm -rf "build/$PKG" "$SRC"
mkdir -p "build/$PKG"
git clone --quiet "https://github.com/iDan-Armstrong/$REPO" "$SRC"
git -C "$SRC" checkout --quiet "$REF"
python3 -m pip wheel --quiet --no-deps "$SRC" -w "build/$PKG"
ls "build/$PKG"
