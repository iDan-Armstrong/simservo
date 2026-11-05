"""Writes tests/fixtures/playbooks.json: the real rdsops and egisops incident playbooks
for every request the game makes (from tools/export-catalog.mjs). The Node unit tests use
the fixture; tests/test_bridge.py checks it still matches the real tools.

    python3 tools/export-playbooks.py
"""

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "site" / "py"))
import simservo_bridge  # noqa: E402


def build():
    cat = json.loads(subprocess.run(["node", str(ROOT / "tools" / "export-catalog.mjs")],
                                    capture_output=True, text=True, check=True).stdout)
    out = {}
    for i in cat["incidents"]:
        key = f"{i['kind']}{'-federal' if i['federal'] else ''}"
        out[key] = json.loads(simservo_bridge.incident_playbook(json.dumps(i["request"])))
    return out


if __name__ == "__main__":
    path = ROOT / "tests" / "fixtures" / "playbooks.json"
    path.write_text(json.dumps(build(), indent=1, sort_keys=True) + "\n")
    print(path)
