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
from egisops import logs as eglogs
from egisops import incident as egincident
from egisops import security as egsecurity
from egisops import backup, datastore, portal, server, services, stack
from rdsops import compat, drill, failover, fleet, health, incident, inventory, maintenance, resilience, security


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


def _services(d: dict) -> services.ServicesSnapshot:
    return services.ServicesSnapshot(
        folders=d.get("folders", []),
        services=[services.Service(**x) for x in d.get("services", [])],
        errors=d.get("errors", []),
    )


def _portal(d: dict) -> portal.PortalSnapshot:
    return portal.PortalSnapshot(
        base_url=d["base_url"],
        health_status=d.get("health_status"),
        health_ok=d.get("health_ok"),
        version=d.get("version"),
        licensed=d.get("licensed"),
        site_error=d.get("site_error"),
        machines=[portal.PortalMachine(m["name"], m.get("role"), m.get("ready"), m.get("reason", ""))
                  for m in d.get("machines", [])],
        entitlements=[portal.Entitlement(e["kind"], e["id"], _dt(e.get("expires")),
                                         e.get("current"), e.get("maximum"))
                      for e in d.get("entitlements", [])],
        members=tuple(d["members"]) if d.get("members") else None,
        certificate=None,
        servers=None if d.get("servers") is None else [
            portal.FederatedServer(x["id"], x["name"], x["admin_url"], x["role"], x.get("function", ""))
            for x in d["servers"]],
        validation_status=d.get("validation_status"),
        validations=[portal.ServerValidation(v["server_id"], v["status"], tuple(v.get("messages", [])),
                                             v.get("admin_url")) for v in d.get("validations", [])],
        indexes=None if d.get("indexes") is None else [
            portal.IndexCount(i["name"], i["database"], i["index"]) for i in d["indexes"]],
        index_sync=d.get("index_sync"),
        errors=d.get("errors", []),
    )


def _datastore(d: dict) -> datastore.DataStoreSnapshot:
    stores = []
    for x in d.get("stores", []):
        x = dict(x)
        x["machines"] = tuple(datastore.DsMachine(**m) for m in x.get("machines", []))
        x["unavailable"] = tuple(x.get("unavailable", []))
        x["last_backup"] = _dt(x.get("last_backup"))
        stores.append(datastore.DataStoreHealth(**x))
    return datastore.DataStoreSnapshot(d["base_url"], stores, d.get("errors", []))


def _backup(d: dict) -> backup.BackupSnapshot:
    return backup.BackupSnapshot(
        properties_path=d.get("properties_path"),
        properties=d.get("properties", {}),
        raw=d.get("raw", {}),
        backups_dir=d.get("backups_dir"),
        backups=None if d.get("backups") is None else [
            backup.BackupFile(b["name"], _dt(b["modified"]), b["size"]) for b in d["backups"]],
        runs=[backup.RunResult(
            path=r["path"], written=_dt(r.get("written")), operation=r.get("operation"),
            status=r.get("status"), backup_location=r.get("backup_location"),
            elapsed=r.get("elapsed"), messages=r.get("messages", ""),
            components=tuple(backup.Component(c["name"], c["status"], c.get("store_type"),
                                              c.get("url"), c.get("messages", ""))
                             for c in r.get("components", [])))
              for r in d.get("runs", [])],
        errors=d.get("errors", []),
    )


def _stack(d: dict) -> stack.StackSnapshot:
    return stack.StackSnapshot(
        components=[stack.Component(c["name"], c["version"]) for c in d.get("components", [])],
        engine_version=d.get("engine_version"),
        postgis_version=d.get("postgis_version"),
        pro_version=d.get("pro_version"),
        target=d.get("target"),
        errors=d.get("errors", []),
    )


def _takeover(d: dict) -> list[dict]:
    from rdsops import aurora

    if d.get("plan"):
        p = d["plan"]
        findings, _steps = aurora.plan(aurora.AuroraRequest(**p["request"]), aurora.AuroraFacts(**p["facts"]))
        return _tag(findings, "aurora-plan")
    c = d.get("compat")
    if c:
        return _tag(compat.check(c["engine_version"], c["arcgis"], c.get("postgis_version"),
                                 platform=c.get("platform", "rds")), "client-compat")
    return []


def _fleet(d: dict) -> fleet.FleetSnapshot:
    return fleet.FleetSnapshot(
        members=[fleet.Member(m["region"], _instance(m["facts"]), m.get("arcgis"), m.get("production", False))
                 for m in d.get("members", [])],
        regions=d.get("regions", []),
        default_arcgis=d.get("default_arcgis"),
        errors=d.get("errors", []),
    )


def _logs(d: dict) -> eglogs.LogSnapshot:
    return eglogs.LogSnapshot(
        hours=d.get("hours", 24),
        level=d.get("level", "SEVERE"),
        entries=[eglogs.LogEntry(e["type"], e.get("code"), e["source"], e["machine"],
                                 e["message"], _dt(e.get("time"))) for e in d.get("entries", [])],
        truncated=d.get("truncated", False),
        errors=d.get("errors", []),
    )


def _security(d: dict) -> security.SecuritySnapshot:
    return security.SecuritySnapshot(
        facts=_instance(d["facts"]),
        region=d.get("region", ""),
        ca_identifier=d.get("ca_identifier"),
        cert_valid_till=_dt(d.get("cert_valid_till")),
        params={k: v for k, v in (d.get("params") or {}).items()},
        log_exports=d.get("log_exports"),
        ingress=None if d.get("ingress") is None else [security.OpenRule(**r) for r in d["ingress"]],
        snapshots=None if d.get("snapshots") is None else [
            security.SnapshotShare(x["identifier"], x["encrypted"], x["public"], tuple(x.get("accounts", ())))
            for x in d["snapshots"]
        ],
        kms_customer_managed=d.get("kms_customer_managed"),
        kms_rotation=d.get("kms_rotation"),
        secret_rotation=d.get("secret_rotation"),
        non_ssl_connections=d.get("non_ssl_connections"),
        md5_roles=d.get("md5_roles"),
        superuser_members=d.get("superuser_members"),
        public_schema_create=d.get("public_schema_create"),
    )


def _server_security(d: dict) -> egsecurity.ServerSecurity:
    keys = egsecurity.ServerSecurity.__dataclass_fields__
    return egsecurity.ServerSecurity(**{k: v for k, v in d.items() if k in keys and k != "certificate"})


def _resilience(d: dict) -> resilience.ResilienceSnapshot:
    return resilience.ResilienceSnapshot(
        facts=_instance(d["facts"]),
        region=d["region"],
        dr_region=d.get("dr_region"),
        production=d.get("production", False),
        latest_restorable=_dt(d.get("latest_restorable")),
        replicas=[resilience.Replica(r["identifier"], r["region"], r.get("status"), r.get("lag_seconds"))
                  for r in d.get("replicas", [])],
        backup_replications=[
            resilience.BackupReplication(b["region"], b["arn"], b.get("retention_days"),
                                         _dt(b.get("latest_restorable")), b.get("status"))
            for b in d.get("backup_replications", [])
        ],
        snapshot_copies=[resilience.SnapshotCopy(c["identifier"], c["region"], _dt(c["created"]), c.get("encrypted", True))
                         for c in d.get("snapshot_copies", [])],
        dr_kms_key=d.get("dr_kms_key"),
        dr_engine_available=d.get("dr_engine_available"),
        failover_events=d.get("failover_events"),
        measured_restore_minutes=d.get("measured_restore_minutes"),
        measured_az_minutes=d.get("measured_az_minutes"),
        measured_region_minutes=d.get("measured_region_minutes"),
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
    if s.get("services"):
        out += _tag(services.evaluate(_services(s["services"])), "services")
    if s.get("logs"):
        out += _tag(eglogs.evaluate(_logs(s["logs"])), "logs")
    if s.get("portal"):
        out += _tag(portal.evaluate(_portal(s["portal"]), _dt(s["now"])), "portal-health")
    if s.get("datastore"):
        out += _tag(datastore.evaluate(_datastore(s["datastore"]), _dt(s["now"])), "datastore")
    if s.get("backups"):
        out += _tag(backup.evaluate(_backup(s["backups"]), _dt(s["now"])), "backup-check")
    if s.get("stack"):
        out += _tag(stack.evaluate(_stack(s["stack"]), *stack.rdsops_hooks()), "stack-compat")
    if s.get("fleet"):
        out += _tag(fleet.evaluate(_fleet(s["fleet"])), "fleet")
    if s.get("takeover"):
        out += _takeover(s["takeover"])
    sec = s.get("security")
    if sec:
        out += _tag(security.evaluate(_security(sec["rds"]), _dt(s["now"])), "security")
        out += _tag(egsecurity.evaluate_server(_server_security(sec["server"]), _dt(s["now"])), "arcgis-security")
    if s.get("resilience"):
        t = s.get("dr_targets") or {}
        out += _tag(
            resilience.evaluate(_resilience(s["resilience"]), _dt(s["now"]),
                                resilience.Targets(t.get("rto", 60.0), t.get("rpo", 15.0))),
            "resilience",
        )
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


def incident_playbook(payload_json: str) -> str:
    """The real rdsops or egisops incident playbook for the game's situation."""
    p = json.loads(payload_json)
    ctx = dict(p["context"])
    for k in ("now", "since", "earliest_restorable"):
        if k in ctx:
            ctx[k] = _dt(ctx[k])
    mod = incident if p["tool"] == "rdsops" else egincident
    pb = mod.playbook(mod.IncidentContext(**ctx))
    out = pb.to_dict()
    out["findings"] = _tag(pb.findings, f"{p['tool']}-incident")
    for st in out["steps"]:
        st["is_command"] = mod.is_command(st["command"])
    return json.dumps(out, default=str)


def failover_plan(payload_json: str) -> str:
    """Real rdsops failover-drill plan on the game's DR setup."""
    p = json.loads(payload_json)
    findings, steps = failover.plan(failover.FailoverRequest(**p["request"]),
                                    _resilience(p["resilience"]), _dt(p["now"]))
    return json.dumps({"findings": _tag(findings, "failover-drill"), "steps": steps}, default=str)


def failover_evaluate(payload_json: str) -> str:
    """Real rdsops scoring of a simulated drill record."""
    p = json.loads(payload_json)
    r = dict(p["result"])
    for k in ("started", "writable_at", "apps_ok_at"):
        if r.get(k):
            r[k] = r[k].replace("+00:00", "Z")
    result = failover.result_from_dict(r)
    return json.dumps(_tag(failover.evaluate(result, failover.FailoverRequest(**p["request"])), "failover-drill"),
                      default=str)


def self_test() -> str:
    """Run during the setup wizard: proves the real rules engine is loaded and answering."""
    lines = [f"rdsops {rdsops.__version__} loaded", f"egisops {egisops.__version__} loaded"]
    for f in compat.check("16.4", "12.1", "3.5.3"):
        lines.append(f"[{f.severity.name:<4}] {f.code}  {f.title}")
    return "\n".join(lines)


def version() -> str:
    return f"rdsops {rdsops.__version__}, egisops {egisops.__version__}"
