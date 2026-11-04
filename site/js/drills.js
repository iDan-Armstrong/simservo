// Restore drills in the simulation. The game builds the same inputs rdsops
// restore-drill gathers from AWS (backup facts, a request, and a result with timings),
// and the real rdsops drill.plan and drill.evaluate score them.

import { GIB, INSTANCE_CLASSES, clock, isoAt, usedBytes } from "./engine.js";

const START = Date.UTC(2026, 0, 5, 6, 0, 0); // must match engine.js
const isoMs = (ms) => new Date(ms).toISOString().replace("Z", "+00:00");
const tickMs = (tick) => START + tick * 3600_000;

// Larger classes restore faster (more network and disk throughput).
const CLASS_SPEED = { "db.t4g.micro": 1.4, "db.t4g.small": 1.2, "db.t4g.medium": 1.0, "db.m7g.large": 0.8 };

export function targets(level) {
  return level >= 31 ? { rto: 30, rpo: 15 } : { rto: 60, rpo: 15 };
}

export function ensureBackupState(s) {
  s.db.snapshots = s.db.snapshots || [];
  s.db.lost = s.db.lost || [];
  s.drills = s.drills || { history: [], last: null };
}

// Called every game hour: RDS takes the daily automated snapshot in the backup window.
export function backupTick(s) {
  ensureBackupState(s);
  const { hour } = clock(s.tick);
  if (s.instance.backupRetention > 0 && hour === 7) {
    const d = new Date(tickMs(s.tick));
    const id = `rds:${s.instance.identifier}-${d.toISOString().slice(0, 10)}-07-00`;
    s.db.snapshots.push({ identifier: id, tick: s.tick, kind: "automated" });
  }
  const keepFrom = s.tick - 24 * Math.max(1, s.instance.backupRetention);
  s.db.snapshots = s.db.snapshots.filter((x) => x.kind === "manual" || x.tick >= keepFrom);
  if (s.instance.backupRetention === 0) s.db.snapshots = s.db.snapshots.filter((x) => x.kind === "manual");
}

export function backupFacts(s) {
  ensureBackupState(s);
  const now = tickMs(s.tick);
  const on = s.instance.backupRetention > 0;
  return {
    source: s.instance.identifier,
    engine_version: s.instance.engineVersion,
    instance_class: s.instance.cls,
    retention_days: s.instance.backupRetention,
    latest_restorable: on ? isoMs(now - 5 * 60_000) : null,
    earliest_restorable: on ? isoMs(now - s.instance.backupRetention * 86_400_000) : null,
    snapshots: s.db.snapshots.map((x) => ({ identifier: x.identifier, created: isoAt(x.tick), kind: x.kind })),
    subnet_group: s.instance.identifier,
    security_groups: ["sg-egdb"],
    parameter_group: s.instance.customParams ? `${s.instance.identifier}-pg17-custom` : null,
    iam_auth: s.instance.iamAuth,
    deletion_protection: s.instance.deletionProtection,
  };
}

export function drillRequest(s, { mode = "pitr", restoreTick = null, level = 1 } = {}) {
  const t = targets(level);
  return {
    source: s.instance.identifier,
    mode,
    restore_time: restoreTick == null ? null : isoMs(tickMs(restoreTick) - 60_000),
    snapshot_id: null,
    target_id: `${s.instance.identifier}-drill-d${clock(s.tick).day}`,
    instance_class: null,
    rto_minutes: t.rto,
    rpo_minutes: t.rpo,
    verify_tables: s.db.tables.filter((x) => x.spatial).slice(0, 2).map((x) => `${x.schema}.${x.table}`),
    keep: false,
  };
}

export function planPayload(s, req) {
  return { request: req, facts: backupFacts(s), now: isoAt(s.tick) };
}

// Simulate the drill's timeline. Returns the payload for drill.evaluate and the game
// hours the operator is busy.
export function simulateDrill(s, req, rand) {
  const sizeGb = usedBytes(s) / GIB;
  const restoreMin = Math.round(9 + 1.3 * sizeGb * (CLASS_SPEED[s.instance.cls] || 1) + rand() * 6);
  const verifyMin = 2 + req.verify_tables.length;
  const t0 = tickMs(s.tick);
  const at = (min) => isoMs(t0 + min * 60_000);
  let restorePoint;
  if (req.mode === "pitr") restorePoint = req.restore_time || isoMs(t0 - 5 * 60_000);
  else {
    const newest = [...s.db.snapshots].sort((a, b) => b.tick - a.tick)[0];
    restorePoint = newest ? isoAt(newest.tick) : null;
  }
  const have = new Set(s.db.tables.map((x) => `${x.schema}.${x.table}`));
  const checks = [
    { name: "connect", ok: true, detail: `PostgreSQL ${s.instance.engineVersion}` },
    { name: "PostGIS present", ok: true, detail: `PostGIS ${s.instance.postgis}` },
    { name: "geodatabase present", ok: true, detail: "sde.sde_version found" },
    ...req.verify_tables.map((t) => {
      const row = s.db.tables.find((x) => `${x.schema}.${x.table}` === t);
      return have.has(t)
        ? { name: `${t} rows`, ok: row.live > 0, detail: `${row.live.toLocaleString("en-US")} rows` }
        : { name: `${t} rows`, ok: false, detail: "table not found in the copy" };
    }),
  ];
  const total = 1 + restoreMin + verifyMin + 1;
  const result = {
    target_id: req.target_id,
    restore_point: restorePoint,
    started: at(0),
    restore_requested: at(1),
    available: at(1 + restoreMin),
    verified: at(1 + restoreMin + verifyMin),
    deleted: at(total),
    checks,
    error: null,
    kept: false,
  };
  const hours = Math.max(1, Math.ceil(total / 60));
  const cost = Math.round(INSTANCE_CLASSES[s.instance.cls].hourly * hours * 100) / 100;
  return { payload: { request: req, result }, hours, cost, restoreMin, verifyMin };
}
