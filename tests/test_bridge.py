"""Parity: the game's snapshots run through the real rdsops evaluators.

Needs rdsops installed (npm run rdsops; pip install build/rdsops/*.whl) and Node.
"""

import json
import pathlib
import re
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "site" / "py"))

import rdsops  # noqa: E402
import simservo_bridge  # noqa: E402

RANK = {"OK": 0, "INFO": 1, "WARN": 2, "FAIL": 3}


@pytest.fixture(scope="module")
def catalog():
    out = subprocess.run(["node", str(ROOT / "tools" / "export-catalog.mjs")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


@pytest.fixture(scope="module")
def rdsops_codes():
    src = pathlib.Path(rdsops.__file__).parent
    text = "".join(p.read_text() for p in src.glob("*.py"))
    return set(re.findall(r'"((?:INV|HLT|MNT|CMP|UPG)\d{3})"', text))


def evaluate(snapshot):
    return json.loads(simservo_bridge.evaluate(json.dumps(snapshot)))


def test_every_code_the_game_uses_exists_in_rdsops(catalog, rdsops_codes):
    used = set(catalog["actionCodes"]) | set(catalog["teaches"])
    assert used <= rdsops_codes, used - rdsops_codes


def test_fresh_game_findings_come_from_rdsops(catalog):
    findings = evaluate(catalog["fresh"])
    by_code = {f["code"]: f for f in findings}
    assert by_code["INV002"]["severity"] == "FAIL"  # the game starts with a public instance
    assert {f["source"] for f in findings} == {"inventory", "health", "maintenance", "compat"}
    assert all(set(f) >= {"code", "severity", "title", "detail", "evidence"} for f in findings)


def test_each_scenario_raises_what_it_teaches(catalog):
    for sc in catalog["scenarios"]:
        if not sc["teaches"]:
            continue
        findings = evaluate(sc["snapshot"])
        raised = {f["code"] for f in findings if RANK[f["severity"]] >= RANK["INFO"]}
        first = sc["teaches"][0]
        assert first in raised, f"{sc['id']} should raise {first}, raised {sorted(raised)}"


def test_self_test_reports_real_failures():
    out = simservo_bridge.self_test()
    assert f"rdsops {rdsops.__version__}" in out
    assert "CMP003" in out and "FAIL" in out
