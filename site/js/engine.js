// SIMServo engine: the simulated network and its hour-by-hour drift.
//
// The engine never decides whether something is a problem. It only moves numbers the
// way a real database moves them (connections follow business hours, edits create dead
// rows, autovacuum cleans them unless an open transaction pins them, an orphaned slot
// holds WAL). `snapshot()` reports those numbers in the exact shape rdsops gathers from
// a real system, and the real rdsops evaluators (run in Pyodide) decide what is wrong.

export const GIB = 2 ** 30;
export const MIB = 2 ** 20;

// Approximate max_connections for RDS PostgreSQL (the default is derived from instance
// memory). Prices are rough us-east-1 on-demand figures, rounded, for the game economy.
export const INSTANCE_CLASSES = {
  "db.t4g.micro": { maxConnections: 87, hourly: 0.016, memGb: 1 },
  "db.t4g.small": { maxConnections: 189, hourly: 0.032, memGb: 2 },
  "db.t4g.medium": { maxConnections: 410, hourly: 0.065, memGb: 4 },
  "db.m7g.large": { maxConnections: 823, hourly: 0.168, memGb: 8 },
};
export const STORAGE_GB_MONTH = 0.115;
export const HOURS_PER_MONTH = 730;

export function rng(seed) {
  // mulberry32: small, fast, deterministic for a given seed
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.UTC(2026, 0, 5, 6, 0, 0); // Monday 06:00 UTC, game clock origin

export function clock(tick) {
  const t = new Date(START + tick * 3600_000);
  return { day: Math.floor(tick / 24) + 1, hour: t.getUTCHours(), weekday: t.getUTCDay(), iso: t.toISOString() };
}

export function isoAt(tick) {
  return tick == null ? null : new Date(START + tick * 3600_000).toISOString().replace("Z", "+00:00");
}

function table(schema, name, live, editsPerHour, bytesPerRow, opts = {}) {
  return {
    schema, table: name, live, dead: 0, mod: 0, editsPerHour, bytesPerRow,
    lastVacuum: 0, lastAnalyze: 0, autovacuum: true, ...opts,
  };
}

export function newGame(seed = 1, callsign = "OPS-1") {
  return {
    schemaVersion: 1,
    seed, callsign, tick: 0,
    budget: 750, revenuePerHour: 4, xp: 0, level: 1,
    achievements: [], quests: [], counters: {}, log: [],
    uptime: { up: 0, down: 0 },
    incidents: {}, // key -> { code, firstTick, severity }
    busyUntil: 0, // ticks while an action is running
    scenarios: { active: [], history: [] },
    instance: {
      identifier: "egdb-lab", engineVersion: "17.7", postgis: "3.5.2", arcgis: "12.1",
      cls: "db.t4g.micro", allocatedGb: 20, maxAllocatedGb: null,
      multiAz: false, public: true, encrypted: true, deletionProtection: false,
      backupRetention: 1, iamAuth: false, autoMinor: true, customParams: false,
      perfInsights: false, managedSecret: true, status: "available", downUntil: 0,
    },
    db: {
      baseConnections: 18, extraConnections: 0, reserved: 3, nextPid: 4100,
      sessions: [], xidAge: 40_000_000, slots: [],
      dataBytes: 6.2 * GIB, walBytes: 0.4 * GIB, logBytes: 0.2 * GIB,
      cacheHit: 0.985, statsResetTick: -24 * 30,
      tables: [
        table("sewer", "manholes", 38_000, 40, 420, { spatial: "shape", hasGist: true }),
        table("sewer", "gravity_mains", 52_000, 60, 610, { spatial: "shape", hasGist: true }),
        table("parcels", "parcels", 210_000, 25, 900, { spatial: "shape", hasGist: true }),
        table("sde", "sde_state_lineages", 9_000, 120, 60),
        table("sde", "sde_states", 3_000, 30, 80),
      ],
      unusedIndexes: [], duplicateIndexes: [], invalidIndexes: [],
      snapshots: [{ identifier: "rds:egdb-lab-2026-01-04-07-00", tick: -23, kind: "automated" }],
      lost: [], // tables dropped by accident, waiting for a restore
    },
    drills: { history: [], last: null },
    arcgis: newSite(),
  };
}

export const EXTRA_MACHINE_MONTH = 140;

export function monthlyCost(s) {
  const c = INSTANCE_CLASSES[s.instance.cls];
  const az = s.instance.multiAz ? 2 : 1;
  const compute = c.hourly * HOURS_PER_MONTH * az;
  const storage = s.instance.allocatedGb * STORAGE_GB_MONTH * az;
  const backup = Math.max(0, s.instance.backupRetention - 1) * 0.6;
  // Each extra Portal or Data Store machine is one more EC2 instance (a rough figure).
  const a = s.arcgis || {};
  const extra = Math.max(0, ((a.portal && a.portal.machines.length) || 1) - 1) + Math.max(0, ((a.datastore && a.datastore.machines.length) || 1) - 1);
  return Math.round((compute + storage + backup + extra * EXTRA_MACHINE_MONTH + drMonthly(s)) * 100) / 100;
}

export function maxConnections(s) {
  return INSTANCE_CLASSES[s.instance.cls].maxConnections;
}

export function usedBytes(s) {
  const slotWal = s.db.slots.reduce((a, x) => a + x.retained, 0);
  const tableBytes = s.db.tables.reduce((a, t) => a + (t.live + t.dead) * t.bytesPerRow, 0);
  return s.db.dataBytes + tableBytes + s.db.walBytes + s.db.logBytes + slotWal;
}

export function freeBytes(s) {
  return s.instance.allocatedGb * GIB - usedBytes(s);
}

import { stackSnapshot } from "./campaign.js";
import { takeoverSnapshot } from "./takeover.js";
import { fleetSnapshot } from "./fleet.js";
import { securitySnapshot } from "./secops.js";
import { drMonthly, resilienceSnapshot } from "./dr.js";
import { backupSnapshot, datastoreSnapshot, logsSnapshot, newSite, portalSnapshot, serverSnapshot, servicesSnapshot, siteUp } from "./arcgis.js";

export { siteUp };

export function isDown(s) {
  return s.instance.status !== "available";
}

export function businessLoad(hour, weekday) {
  if (weekday === 0 || weekday === 6) return 0.25;
  if (hour >= 13 && hour < 23) return 1; // 08:00-18:00 US Eastern, in UTC
  if (hour >= 11 && hour < 13) return 0.6;
  return 0.15;
}

export function addSession(s, fields) {
  const pid = s.db.nextPid++;
  s.db.sessions.push({ pid, user: "gis_editor", application: "ArcGIS Pro", state: "active", since: s.tick, query: "", blocks: false, ...fields });
  return pid;
}

// Advance one game hour. Returns notes for the log (not findings; rdsops makes those).
export function step(s, rand) {
  const notes = [];
  s.tick += 1;
  const { hour, weekday } = clock(s.tick);
  const load = businessLoad(hour, weekday);
  const inst = s.instance;

  if (isDown(s) && s.tick >= inst.downUntil && inst.downUntil > 0) {
    inst.status = "available";
    inst.downUntil = 0;
    notes.push({ kind: "recover", text: "Instance is back: status available." });
  }
  // Users see a service as down if either the database or ArcGIS Server is down.
  if (isDown(s) || !siteUp(s)) {
    s.uptime.down += 1;
    s.budget -= s.revenuePerHour; // lost business while down
  } else {
    s.uptime.up += 1;
    const broken = (s.db.lost || []).length ? 0.5 : 1; // maps with a missing layer earn less
    s.budget += s.revenuePerHour * (0.5 + load) * broken;
  }
  s.budget -= monthlyCost(s) / HOURS_PER_MONTH;

  const pinned = s.db.sessions.some((x) => x.state.startsWith("idle in transaction"));
  for (const t of s.db.tables) {
    const edits = Math.round(t.editsPerHour * load * (0.7 + rand() * 0.6));
    t.dead += edits;
    t.mod += edits;
    // autovacuum: runs when dead rows pass ~20% + 50, unless an open transaction pins them
    if (t.autovacuum && !pinned && t.dead > 50 + 0.2 * t.live && rand() < 0.8) {
      t.dead = Math.round(t.dead * 0.05);
      t.lastVacuum = s.tick;
    }
    if (t.autovacuum && t.mod > 50 + 0.1 * t.live && rand() < 0.8) {
      t.mod = 0;
      t.lastAnalyze = s.tick;
    }
  }

  // XID consumption; autovacuum freezes while it can
  s.db.xidAge += Math.round(150_000 * (0.5 + load));
  if (!pinned && s.db.xidAge > 200_000_000 && rand() < 0.3) s.db.xidAge = 50_000_000;

  // WAL and logs; orphaned slots keep WAL forever
  for (const slot of s.db.slots) {
    if (!slot.active) slot.retained += slot.growth;
  }
  s.db.logBytes = Math.min(s.db.logBytes + 4 * MIB, 1.5 * GIB);
  s.db.dataBytes += 2 * MIB * load;

  // storage autoscaling (RDS grows by at least 10% when free space is low)
  if (inst.maxAllocatedGb && freeBytes(s) < 0.1 * inst.allocatedGb * GIB && inst.allocatedGb < inst.maxAllocatedGb) {
    const grown = Math.min(inst.maxAllocatedGb, Math.ceil(inst.allocatedGb * 1.1 + 5));
    notes.push({ kind: "info", text: `Storage autoscaling: ${inst.allocatedGb} GB -> ${grown} GB.` });
    inst.allocatedGb = grown;
  }
  if (!isDown(s) && freeBytes(s) <= 0) {
    inst.status = "storage-full";
    inst.downUntil = 0;
    notes.push({ kind: "outage", text: "STORAGE FULL. The instance stopped accepting writes." });
  }

  // client sessions follow business load
  const wanted = Math.round((s.db.baseConnections + s.db.extraConnections) * (0.4 + load) + rand() * 4);
  const background = s.db.sessions.filter((x) => x.state === "idle" && x.pool);
  // PostgreSQL refuses connections past max_connections (minus the reserved slots).
  const room = maxConnections(s) - s.db.reserved - (s.db.sessions.length - background.length);
  const target = Math.min(wanted, Math.max(0, room));
  s.db.refused = Math.max(0, wanted - target);
  if (s.db.refused > 0) notes.push({ kind: "warn", text: `FATAL: sorry, too many clients already (${s.db.refused} ArcGIS Server connections refused this hour)` });
  if (background.length < target) {
    for (let i = background.length; i < target; i++) addSession(s, { state: "idle", pool: true, application: "ArcSOC", user: "sde", query: "" });
  } else {
    let drop = background.length - target;
    s.db.sessions = s.db.sessions.filter((x) => !(x.pool && drop-- > 0));
  }
  s.db.cacheHit = Math.max(0.7, Math.min(0.995, s.db.cacheHit + (rand() - 0.5) * 0.004));
  return notes;
}

// ------------------------------------------------------------------ snapshot
// Same field names as the rdsops dataclasses (HealthSnapshot, MaintenanceSnapshot,
// InstanceFacts). The bridge passes them straight through.

export function snapshot(s, { production = false } = {}) {
  const inst = s.instance;
  const facts = {
    identifier: inst.identifier, engine: "postgres", engine_version: inst.engineVersion,
    instance_class: inst.cls, status: inst.status,
    endpoint: `${inst.identifier}.c0ffee.us-east-1.rds.amazonaws.com`, port: 5432,
    multi_az: inst.multiAz, publicly_accessible: inst.public, storage_encrypted: inst.encrypted,
    kms_key_id: inst.encrypted ? "alias/egdb-lab-db" : null,
    deletion_protection: inst.deletionProtection, backup_retention_days: inst.backupRetention,
    iam_auth: inst.iamAuth, auto_minor_version_upgrade: inst.autoMinor,
    performance_insights: inst.perfInsights,
    parameter_groups: [inst.customParams ? "egdb-lab-pg17-custom" : `default.postgres${inst.engineVersion.split(".")[0]}`],
    ca_cert: "rds-ca-rsa2048-g1", allocated_storage_gb: inst.allocatedGb,
    max_allocated_storage_gb: inst.maxAllocatedGb, managed_master_secret: inst.managedSecret,
  };
  const out = {
    production,
    now: isoAt(s.tick),
    server: s.arcgis ? serverSnapshot(s) : undefined,
    services: s.arcgis ? servicesSnapshot(s) : undefined,
    logs: s.arcgis ? logsSnapshot(s) : undefined,
    portal: s.arcgis ? portalSnapshot(s) : undefined,
    datastore: s.arcgis ? datastoreSnapshot(s) : undefined,
    backups: s.arcgis ? backupSnapshot(s) : undefined,
    stack: s.arcgis ? stackSnapshot(s) : undefined,
    takeover: takeoverSnapshot(s),
    fleet: fleetSnapshot(s, { facts, production }),
    security: securitySnapshot(s, facts, isoAt),
    resilience: resilienceSnapshot(s, facts),
    dr_targets: s.dr && s.dr.started != null ? { rto: s.level >= 31 ? 30 : 60, rpo: 15 } : undefined,
    instance: facts,
    storage: { free_bytes: Math.max(0, Math.round(freeBytes(s))), allocated_gb: inst.allocatedGb, max_allocated_gb: inst.maxAllocatedGb },
    compat: { engine_version: inst.engineVersion, arcgis: inst.arcgis, postgis_version: inst.postgis },
  };
  if (inst.status !== "available") return out; // cannot connect: no SQL-level snapshot

  const secondsSince = (t) => (s.tick - t) * 3600;
  const asSession = (x) => ({ pid: x.pid, user: x.user, application: x.application, state: x.state, seconds: secondsSince(x.since), query: x.query });
  const clients = s.db.sessions;
  const byState = {};
  for (const x of clients) byState[x.state] = (byState[x.state] || 0) + 1;
  const blockers = clients.filter((x) => x.blocks);
  out.health = {
    server_version: inst.engineVersion,
    postgis_version: inst.postgis,
    max_connections: maxConnections(s),
    reserved_connections: s.db.reserved,
    client_connections: clients.length,
    connections_by_state: byState,
    long_running: clients.filter((x) => x.state === "active" && secondsSince(x.since) > 900).map(asSession),
    idle_in_transaction: clients.filter((x) => x.state.startsWith("idle in transaction") && secondsSince(x.since) > 300).map(asSession),
    blocked_pids: blockers.length ? clients.filter((x) => x.waiting).map((x) => x.pid) : [],
    oldest_xid_age: s.db.xidAge,
    oldest_xid_database: "egdb",
    slots: s.db.slots.map((x) => ({ name: x.name, active: x.active, retained_bytes: Math.round(x.retained) })),
    database_size_bytes: Math.round(usedBytes(s) - s.db.walBytes - s.db.logBytes),
    cache_hit_ratio: s.db.cacheHit,
    stat_statements: inst.customParams ? "ok" : "not-preloaded",
    top_queries: inst.customParams
      ? [{ query: "SELECT shape, facilityid FROM sewer.gravity_mains WHERE shape && $1", calls: 18_400 + s.tick * 40, total_ms: 92_000 + s.tick * 210, mean_ms: 5.1 }]
      : [],
  };
  out.maintenance = {
    stats_age_days: (s.tick - s.db.statsResetTick) / 24,
    tables: s.db.tables.map((t) => ({
      schema: t.schema, table: t.table, live: t.live, dead: t.dead, mod_since_analyze: t.neverAnalyzed ? t.live : t.mod,
      last_vacuum: t.neverVacuumed ? null : isoAt(t.lastVacuum),
      last_analyze: t.neverAnalyzed ? null : isoAt(t.lastAnalyze),
      total_bytes: Math.round((t.live + t.dead) * t.bytesPerRow),
    })),
    unused_indexes: s.db.unusedIndexes,
    duplicate_indexes: s.db.duplicateIndexes,
    invalid_indexes: s.db.invalidIndexes,
    unindexed_spatial: s.db.tables.filter((t) => t.spatial && !t.hasGist).map((t) => ({ schema: t.schema, table: t.table, column: t.spatial, kind: "geometry", rows: t.live })),
  };
  return out;
}
