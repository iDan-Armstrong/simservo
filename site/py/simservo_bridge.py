"""SIMServo bridge: simulated snapshots in, real rdsops findings out.

The game engine (JavaScript) builds snapshots in the same shape rdsops gathers from a
real database and AWS account. This module turns them into rdsops dataclasses and runs
the real evaluators. Nothing here decides severity or thresholds; rdsops does.

Runs in the browser under Pyodide, and under CPython in the test suite.
"""

from __future__ import annotations

import json
from datetime import datetime

import egisops
import rdsops
from egisops import server
from rdsops import compat, drill, health, inventory, maintenance


def _dt(value):
    return datetime.fromisoformat(value) if value else None


def _health(h: dict) -> health.HealthSnapshot:
    return health.HealthSnapshot(
        server_version=h["server_version"],
        postgis_version=h.get("postgis_version"),
        max_connections=h["max_connections"],
        reserved_connections=h["reserved_connections"],
        client_connections=h["client_connections"],
        connections_by_state=h.get("connections_by_state", {}),
        long_running=[health.Session(**s) for s in h.get("long_running", [])],
        idle_in_transaction=[health.Session(**s) for s in h.get("idle_in_transaction", [])],
        blocked_pids=h.get("blocked_pids", []),
        oldest_xid_age=h["oldest_xid_age"],
        oldest_xid_database=h.get("oldest_xid_database"),
        slots=[health.Slot(**s) for s in h.get("slots", [])],
        database_size_bytes=h.get("database_size_bytes", 0),
        cache_hit_ratio=h.get("cache_hit_ratio"),
        stat_statements=h.get("stat_statements", "missing"),
        top_queries=[health.TopQuery(**q) for q in h.get("top_queries", [])],
    )


def _maintenance(m: dict) -> maintenance.MaintenanceSnapshot:
    return maintenance.MaintenanceSnapshot(
        stats_age_days=m.get("stats_age_days"),
        tables=[
            maintenance.TableStat(
                t["schema"], t["table"], t["live"], t["dead"], t["mod_since_analyze"],
                _dt(t.get("last_vacuum")), _dt(t.get("last_analyze")), t["total_bytes"],
            )
            for t in m.get("tables", [])
        ],
        unused_indexes=[maintenance.IndexRef(**i) for i in m.get("unused_indexes", [])],
        duplicate_indexes=[
            [maintenance.IndexRef(**i) for i in group] for group in m.get("duplicate_indexes", [])
        ],
        invalid_indexes=[maintenance.IndexRef(**i) for i in m.get("invalid_indexes", [])],
        unindexed_spatial=[
            maintenance.SpatialColumn(**c) for c in m.get("unindexed_spatial", [])
        ],
    )


def _instance(i: dict) -> inventory.InstanceFacts:
    i = dict(i)
    i["parameter_groups"] = tuple(i.get("parameter_groups", ()))
    return inventory.InstanceFacts(**i)


def _server(d: dict) -> server.ServerSnapshot:
    c = d.get("certificate")
    return server.ServerSnapshot(
        base_url=d["base_url"],
        health_status=d.get("health_status"),
        health_success=d.get("health_success"),
        full_version=d.get("full_version"),
        licensed=d.get("licensed"),
        machines=[server.Machine(m["name"], m["configured"], m.get("realtime"))
                  for m in d.get("machines", [])],
        licenses=[server.LicenseItem(x["name"], x["can_expire"], _dt(x.get("expires")))
                  for x in d.get("licenses", [])],
        certificate=server.Certificate(c["host"], c["subject"], c["issuer"],
                                       _dt(c["not_after"]), c["trusted"]) if c else None,
        errors=d.get("errors", []),
    )


def _tag(findings, source):
    out = []
    for f in findings:
        d = f.to_dict()
        d["source"] = source
        out.append(d)
    return out


def evaluate(snapshot_json: str) -> str:
    """One call per game tick. Returns a JSON list of findings, each tagged with its check."""
    s = json.loads(snapshot_json)
    out = []
    out += _tag(
        inventory.posture_findings(_instance(s["instance"]), production=s.get("production", False)),
        "inventory",
    )
    if s.get("server"):
        out += _tag(server.evaluate(_server(s["server"]), _dt(s["now"])), "server-health")
    if s.get("health"):
        out += _tag(health.evaluate(_health(s["health"])), "health")
    st = s.get("storage")
    if st:
        out += _tag(
            health.storage_evaluate(st["free_bytes"], st["allocated_gb"], st.get("max_allocated_gb")),
            "health",
        )
    if s.get("maintenance"):
        out += _tag(maintenance.evaluate(_maintenance(s["maintenance"])), "maintenance")
    c = s.get("compat")
    if c:
        out += _tag(compat.check(c["engine_version"], c["arcgis"], c.get("postgis_version")), "compat")
    return json.dumps(out, default=str)


def _facts(f: dict) -> drill.BackupFacts:
    return drill.BackupFacts(
        source=f["source"],
        engine_version=f["engine_version"],
        instance_class=f["instance_class"],
        retention_days=f["retention_days"],
        latest_restorable=_dt(f.get("latest_restorable")),
        earliest_restorable=_dt(f.get("earliest_restorable")),
        snapshots=[drill.Snapshot(x["identifier"], _dt(x["created"]), x["kind"])
                   for x in f.get("snapshots", [])],
        subnet_group=f.get("subnet_group"),
        security_groups=f.get("security_groups", []),
        parameter_group=f.get("parameter_group"),
        iam_auth=f.get("iam_auth", False),
        deletion_protection=f.get("deletion_protection", False),
    )


def _request(r: dict) -> drill.DrillRequest:
    r = dict(r)
    r["restore_time"] = _dt(r.get("restore_time"))
    return drill.DrillRequest(**r)


def drill_plan(payload_json: str) -> str:
    """Real rdsops restore-drill planning on the game's backup facts."""
    p = json.loads(payload_json)
    findings, steps = drill.plan(_request(p["request"]), _facts(p["facts"]), _dt(p["now"]))
    return json.dumps({"findings": _tag(findings, "restore-drill"), "steps": steps}, default=str)


def drill_evaluate(payload_json: str) -> str:
    """Real rdsops scoring of a simulated drill's timings and checks."""
    p = json.loads(payload_json)
    r = p["result"]
    result = drill.DrillResult(
        target_id=r["target_id"],
        restore_point=_dt(r.get("restore_point")),
        started=_dt(r["started"]),
        restore_requested=_dt(r.get("restore_requested")),
        available=_dt(r.get("available")),
        verified=_dt(r.get("verified")),
        deleted=_dt(r.get("deleted")),
        checks=[drill.VerifyCheck(**c) for c in r.get("checks", [])],
        error=r.get("error"),
        kept=r.get("kept", False),
    )
    return json.dumps(_tag(drill.evaluate(result, _request(p["request"])), "restore-drill"),
                      default=str)


def self_test() -> str:
    """Run during the setup wizard: proves the real rules engine is loaded and answering."""
    lines = [f"rdsops {rdsops.__version__} loaded", f"egisops {egisops.__version__} loaded"]
    for f in compat.check("16.4", "12.1", "3.5.3"):
        lines.append(f"[{f.severity.name:<4}] {f.code}  {f.title}")
    return "\n".join(lines)


def version() -> str:
    return f"rdsops {rdsops.__version__}, egisops {egisops.__version__}"
