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

import egisops  # noqa: E402
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
    """Finding codes defined in the real tools (rdsops and egisops)."""
    text = ""
    for pkg in (rdsops, egisops):
        text += "".join(p.read_text() for p in pathlib.Path(pkg.__file__).parent.glob("*.py"))
    return set(re.findall(r'"((?:INV|HLT|MNT|CMP|UPG|DRL|SRV|SVC|LOG|PTL|DST)\d{3})"', text))


def evaluate(snapshot):
    return json.loads(simservo_bridge.evaluate(json.dumps(snapshot)))


def test_every_code_the_game_uses_exists_in_rdsops(catalog, rdsops_codes):
    used = set(catalog["actionCodes"]) | set(catalog["teaches"])
    assert used <= rdsops_codes, used - rdsops_codes


def test_fresh_game_findings_come_from_rdsops(catalog):
    findings = evaluate(catalog["fresh"])
    by_code = {f["code"]: f for f in findings}
    assert by_code["INV002"]["severity"] == "FAIL"  # the game starts with a public instance
    assert {f["source"] for f in findings} == {
        "inventory", "server-health", "services", "logs", "portal-health", "datastore",
        "health", "maintenance", "compat"}
    assert by_code["SRV006"]["severity"] == "WARN"  # fresh installs ship a self-signed certificate
    # one portal machine and one data store machine: worth knowing, not broken
    assert by_code["PTL003"]["severity"] == "INFO" and "PTL007" not in by_code
    assert {f["code"] for f in findings if f["source"] == "datastore" and f["severity"] == "INFO"} == {"DST003"}
    assert by_code["PTL008"]["severity"] == "OK"
    assert all(set(f) >= {"code", "severity", "title", "detail", "evidence"} for f in findings)


def test_each_scenario_raises_what_it_teaches(catalog):
    for sc in catalog["scenarios"]:
        if not sc["teaches"]:
            continue
        if sc["via"] == "drill-plan":
            findings = json.loads(simservo_bridge.drill_plan(json.dumps(sc["drillPlan"])))["findings"]
        elif sc["via"] == "drill-evaluate":
            findings = json.loads(simservo_bridge.drill_evaluate(json.dumps(sc["drillEvaluate"])))
        else:
            findings = evaluate(sc["snapshot"])
        # Snapshot scenarios must raise a problem; drill scenarios are answered by a drill,
        # so the code being scored at all (OK when the drill passes) is what counts.
        floor = RANK["INFO"] if sc["via"] == "snapshot" else RANK["OK"]
        raised = {f["code"] for f in findings if RANK[f["severity"]] >= floor}
        first = sc["teaches"][0]
        assert first in raised, f"{sc['id']} should raise {first}, raised {sorted(raised)}"


def test_self_test_reports_real_failures():
    out = simservo_bridge.self_test()
    assert f"rdsops {rdsops.__version__}" in out and f"egisops {egisops.__version__}" in out
    assert "CMP003" in out and "FAIL" in out


def test_healthy_drill_plans_and_scores_clean(catalog):
    plan = json.loads(simservo_bridge.drill_plan(json.dumps(catalog["drill"]["plan"])))
    assert all(RANK[f["severity"]] <= RANK["INFO"] for f in plan["findings"]), plan["findings"]
    assert any("restore-db-instance-to-point-in-time" in s for s in plan["steps"])
    scored = json.loads(simservo_bridge.drill_evaluate(json.dumps(catalog["drill"]["evaluate"])))
    codes = {f["code"]: f["severity"] for f in scored}
    assert codes["DRL010"] == "OK" and codes["DRL011"] == "OK" and codes["DRL014"] == "OK"
    assert all(f["source"] == "restore-drill" for f in scored)


def test_dropped_table_without_backups_cannot_be_restored(catalog):
    sc = next(x for x in catalog["scenarios"] if x["id"] == "dropped_table")
    plan = json.loads(simservo_bridge.drill_plan(json.dumps(sc["drillPlan"])))
    assert {"code": "DRL001", "severity": "FAIL"}.items() <= next(
        f for f in plan["findings"] if f["code"] == "DRL001").items()


def test_data_store_failover_keeps_hosted_layers_up(catalog):
    sc = next(x for x in catalog["scenarios"] if x["id"] == "datastore_down")
    snap = sc["snapshot"]
    findings = evaluate(snap)
    sev = {(f["code"], f["severity"]) for f in findings}
    assert ("DST002", "FAIL") in sev and ("PTL008", "FAIL") in sev and ("DST001", "FAIL") in sev
    # the same outage with a standby: the standby is primary, only a WARN remains
    d = snap["datastore"]["stores"][0]
    d["overall"] = "Healthy"
    d["machines"] = [dict(d["machines"][0], role="STANDBY"),
                     {"name": "DATASTORE2.EXAMPLE.COM", "role": "PRIMARY", "reachable": True,
                      "status": "Started", "health": "Healthy", "accepting": True}]
    ds = [f for f in evaluate(snap) if f["source"] == "datastore"]
    assert max(RANK[f["severity"]] for f in ds) == RANK["WARN"]
