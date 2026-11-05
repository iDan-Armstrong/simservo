// Tier 9: High Availability and DR.
//
// The game keeps your disaster recovery setup: a DR Region, a KMS key there, cross-Region
// automated backup replication, a cross-Region read replica, snapshot copies, a failover
// event subscription, and how long ArcGIS Server's JVM caches DNS. The real rdsops
// resilience scores it (source "resilience"): which paths exist for zone and Region loss,
// the data each would lose, and how long each takes. Recovery times come only from AWS's
// Multi-AZ figure or from drills you ran, never from a guess (rdsops ADR 0009).
//
// Drills go through the real rdsops failover-drill: its plan says whether the drill can
// run, the game simulates the timeline, and its evaluate scores it. Measured times feed
// back into resilience.
//
// When the Region goes down (a regional outage, or Trollzilla), you fail over using the
// paths the real tool lists. A drilled path goes as measured. An undrilled one costs
// hours of working it out on the day.
//
// Regions, accounts and names are made up where they are not AWS's.

import { GIB, INSTANCE_CLASSES, isoAt, usedBytes } from "./engine.js";

export const UNLOCK_LEVEL = 16;
export const DR_REGION = "us-west-2";
const ACCOUNT = "111122223333"; // made up
const CLASS_SPEED = { "db.t4g.micro": 1.4, "db.t4g.small": 1.2, "db.t4g.medium": 1.0, "db.m7g.large": 0.8 };
export const UNDRILLED_PENALTY_HOURS = 3; // finding the runbook, the key, the ARN, on the day
const BACKUP_REPLICATION_MONTH = 6; // rough: snapshot copy transfer and storage in the DR Region

export function newDr() {
  return {
    started: null,
    drRegion: DR_REGION,
    kmsKey: false,
    backupReplication: null, // { since, status }
    replica: null, // { id, since, status, lagSec }
    copies: [], // { id, tick }
    events: false,
    jvmTtl: "never", // ArcGIS Server's JVM caches DNS until restart; 60 is AWS's advice
    measured: { az: null, region: null },
    lastDrill: null,
    activeRegion: "us-east-1",
    history: [],
  };
}

export function ensureDr(s) {
  if (!s.dr) s.dr = newDr();
  return s.dr;
}

export function drUnlocked(s) {
  return s.level >= UNLOCK_LEVEL;
}

export function startDr(s) {
  const d = ensureDr(s);
  if (d.started != null || !drUnlocked(s)) return false;
  d.started = s.tick;
  return true;
}

export function drMonthly(s) {
  const d = s.dr;
  if (!d || d.started == null) return 0;
  let m = 0;
  if (d.backupReplication) m += BACKUP_REPLICATION_MONTH;
  if (d.replica) m += INSTANCE_CLASSES[s.instance.cls].hourly * 730 + s.instance.allocatedGb * 0.115;
  m += d.copies.length * 0.5;
  return m;
}

const arn = (s, region = "us-east-1") => `arn:aws:rds:${region}:${ACCOUNT}:db:${s.instance.identifier}`;
const restoreMinutes = (s, rand) => Math.round(9 + 1.3 * (usedBytes(s) / GIB) * (CLASS_SPEED[s.instance.cls] || 1) + rand() * 6);

function measuredRestore(s) {
  const last = s.drills && s.drills.last;
  const f = last && last.ran && (last.findings || []).find((x) => x.code === "DRL011");
  return f && f.evidence ? f.evidence.rto_minutes : null;
}

// Same field names as rdsops.resilience.ResilienceSnapshot.
export function resilienceSnapshot(s, facts) {
  const d = s.dr;
  if (!d || d.started == null) return undefined;
  const replicating = d.backupReplication && d.backupReplication.status === "replicating";
  return {
    facts,
    region: "us-east-1",
    dr_region: d.drRegion,
    production: s.level >= 8,
    latest_restorable: s.instance.backupRetention > 0 ? isoAt(s.tick - 5 / 60) : null,
    replicas: d.replica ? [{ identifier: d.replica.id, region: d.drRegion, status: d.replica.status, lag_seconds: d.replica.lagSec }] : [],
    backup_replications: d.backupReplication
      ? [{ region: d.drRegion, arn: `arn:aws:rds:${d.drRegion}:${ACCOUNT}:auto-backup:ab-egdblab0001`, retention_days: 7,
          latest_restorable: replicating ? isoAt(s.tick - 10 / 60) : isoAt(d.backupReplication.lastTick ?? d.backupReplication.since), status: d.backupReplication.status }]
      : [],
    snapshot_copies: d.copies.map((c) => ({ identifier: c.id, region: d.drRegion, created: isoAt(c.tick), encrypted: true })),
    dr_kms_key: s.instance.encrypted ? d.kmsKey : null,
    dr_engine_available: true,
    failover_events: d.events,
    measured_restore_minutes: measuredRestore(s),
    measured_az_minutes: d.measured.az,
    measured_region_minutes: d.measured.region,
  };
}

// ------------------------------------------------------------------ fixes

const fix = (id, label, hours, command, apply, available = () => true) => ({ id, label, hours, cost: 0, command, apply, available: (s) => available(s) });

const KEY = fix("dr_key", `Create a KMS key in ${DR_REGION}`, 0,
  () => `aws kms create-key --region ${DR_REGION} --description "egdb-lab DR" && aws kms create-alias --region ${DR_REGION} --alias-name alias/egdb-lab-dr --target-key-id <key id>`,
  (s) => { s.dr.kmsKey = true; }, (s) => !s.dr.kmsKey);
const REPLICATE = fix("backup_replication", `Replicate automated backups to ${DR_REGION}`, 1,
  (f, s) => `aws rds start-db-instance-automated-backups-replication --region ${DR_REGION} --source-db-instance-arn ${arn(s)} --source-region us-east-1 --backup-retention-period 7 --kms-key-id alias/egdb-lab-dr`,
  (s) => { s.dr.backupReplication = { since: s.tick, status: "replicating" }; },
  (s) => !s.dr.backupReplication && (s.dr.kmsKey || !s.instance.encrypted) && s.instance.backupRetention > 0);
const REPLICA = fix("dr_replica", `Create a read replica in ${DR_REGION} (bills like a second instance)`, 2,
  (f, s) => `aws rds create-db-instance-read-replica --region ${DR_REGION} --db-instance-identifier ${s.instance.identifier}-dr --source-db-instance-identifier ${arn(s)} --source-region us-east-1 --kms-key-id alias/egdb-lab-dr --no-publicly-accessible`,
  (s) => { s.dr.replica = { id: `${s.instance.identifier}-dr`, since: s.tick, status: "replicating", lagSec: 20 }; },
  (s) => !s.dr.replica && (s.dr.kmsKey || !s.instance.encrypted) && s.instance.backupRetention > 0);
const COPY = fix("copy_snapshot", `Copy the newest snapshot to ${DR_REGION}`, 1,
  (f, s) => `aws rds copy-db-snapshot --region ${DR_REGION} --source-db-snapshot-identifier <newest snapshot ARN> --target-db-snapshot-identifier ${s.instance.identifier}-copy-${s.tick} --source-region us-east-1 --kms-key-id alias/egdb-lab-dr --copy-tags`,
  (s) => { s.dr.copies.push({ id: `${s.instance.identifier}-copy-${s.tick}`, tick: s.tick }); if (s.dr.copies.length > 4) s.dr.copies.shift(); },
  (s) => s.dr.kmsKey || !s.instance.encrypted);
const MULTI_AZ = fix("dr_multi_az", "Turn on Multi-AZ", 1,
  (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --multi-az --apply-immediately`,
  (s) => { s.instance.multiAz = true; }, (s) => !s.instance.multiAz);
const EVENTS = fix("failover_events", "Subscribe the on-call to failover events", 0,
  (f, s) => `aws rds create-event-subscription --subscription-name egdb-failover --sns-topic-arn arn:aws:sns:us-east-1:${ACCOUNT}:oncall --source-type db-instance --source-ids ${s.instance.identifier} --event-categories failover availability`,
  (s) => { s.dr.events = true; });
const REBUILD = fix("rebuild_replica", "Recreate the replica", 2,
  (f, s) => `aws rds delete-db-instance --region ${DR_REGION} --db-instance-identifier ${s.instance.identifier}-dr --skip-final-snapshot; then create-db-instance-read-replica again`,
  (s) => { s.dr.replica = { id: `${s.instance.identifier}-dr`, since: s.tick, status: "replicating", lagSec: 20 }; });
const scenarioOf = (f) => (f.evidence || {}).scenario;

export const DR_ACTIONS = {
  RES001: [MULTI_AZ],
  RES002: [KEY, REPLICATE, REPLICA, COPY],
  RES003: [
    { ...MULTI_AZ, available: (s, f) => scenarioOf(f || {}) !== "region" && !s.instance.multiAz },
    { ...KEY, available: (s, f) => scenarioOf(f || {}) === "region" && !s.dr.kmsKey },
    { ...REPLICATE, available: (s, f) => scenarioOf(f || {}) === "region" && REPLICATE.available(s) },
    { ...REPLICA, available: (s, f) => scenarioOf(f || {}) === "region" && REPLICA.available(s) },
  ],
  RES004: [{ ...MULTI_AZ, available: (s, f) => scenarioOf(f || {}) !== "region" && !s.instance.multiAz }],
  RES005: [KEY],
  RES007: [REBUILD],
  RES008: [EVENTS],
};

// ------------------------------------------------------------------ world

// Replication drifts. The replica can break; replicated backups follow the source.
export function drTick(s, rand, log) {
  const d = s.dr;
  if (!d || d.started == null) return;
  if (d.replica && d.replica.status === "replicating") {
    d.replica.lagSec = Math.max(5, Math.round(d.replica.lagSec * 0.6 + rand() * 40 + (s.db.extraConnections > 0 ? 600 : 0)));
    if (rand() < 0.004) {
      d.replica.status = "error";
      log({ kind: "warn", text: `${d.replica.id}: replication stopped (read replication: error). The DR copy is falling behind.` });
    }
  }
  if (d.backupReplication && d.backupReplication.status === "replicating" && s.instance.backupRetention === 0) {
    d.backupReplication.status = "stopped";
    d.backupReplication.lastTick = s.tick;
    log({ kind: "warn", text: `Backup replication to ${d.drRegion} stopped: automated backups are off at the source.` });
  }
}

// ------------------------------------------------------------------ drills

export function drillRequest(s, kind, targets) {
  return { kind, instance: s.instance.identifier, region: "us-east-1", dr_region: s.dr.drRegion, rto_minutes: targets.rto, rpo_minutes: targets.rpo, target: `${s.instance.identifier}-dr-drill-${s.tick}` };
}

// The simulated timeline of a drill, as the JSON record a person would fill in.
export function simulateFailover(s, kind, rand) {
  const d = s.dr;
  const t0 = s.tick;
  const iso = (min) => isoAt(t0 + min / 60);
  const reconnect = d.jvmTtl === 60 ? 1 + Math.round(rand() * 2) : 18 + Math.round(rand() * 10);
  if (kind === "az") {
    const failover = 1 + Math.round(rand() * 10) / 10; // AWS: typically 60-120 s
    return {
      result: { kind, started: iso(0), writable_at: iso(failover), apps_ok_at: iso(failover + reconnect), data_loss_seconds: 0,
                checks: [{ name: "failover events recorded", ok: true }, { name: "ArcGIS services answer", ok: true }] },
      minutes: failover + reconnect + 10,
      outageMinutes: failover + reconnect,
    };
  }
  const restore = restoreMinutes(s, rand);
  const loss = d.backupReplication && d.backupReplication.status === "replicating" ? 300 + Math.round(rand() * 300)
    : d.copies.length ? (s.tick - d.copies[d.copies.length - 1].tick) * 3600 : null;
  return {
    result: { kind, started: iso(0), writable_at: iso(2 + restore), apps_ok_at: iso(2 + restore + 6 + (d.jvmTtl === 60 ? 0 : 4)), data_loss_seconds: loss,
              checks: [{ name: "PostGIS present", ok: true }, { name: "geodatabase present", ok: true }, { name: "staging data store validates", ok: true }] },
    minutes: restore + 20,
    outageMinutes: 0,
  };
}

export function recordDrill(s, kind, findings) {
  const d = s.dr;
  const rto = findings.find((f) => f.code === "DRD001");
  if (rto && rto.evidence) d.measured[kind] = rto.evidence.rto_minutes;
  d.lastDrill = { kind, tick: s.tick, findings };
  d.history.push({ kind, tick: s.tick, clean: !findings.some((f) => f.severity === "WARN" || f.severity === "FAIL") });
  if (d.history.length > 20) d.history.shift();
}

export const TTL_FIX = {
  label: "Set the JVM DNS TTL to 60 s on ArcGIS Server machines",
  command: "networkaddress.cache.ttl=60 in the JVM security properties of each ArcGIS Server machine, then restart ArcGIS Server",
};

// ------------------------------------------------------------------ the bad day

// Ways back when us-east-1 is gone, from the real resilience findings' evidence.
export function regionPaths(findings) {
  const f = findings.find((x) => x.code === "RES002" && x.evidence && x.evidence.paths);
  return f ? f.evidence.paths : [];
}

// Fail over along one path. Returns hours down, minutes of data lost, and what it used up.
export function failOver(s, path, rand) {
  const d = s.dr;
  let minutes = path.rto_minutes;
  let drilled = minutes != null;
  if (!drilled) minutes = (path.name.startsWith("Cross-Region read replica") ? 25 : restoreMinutes(s, rand) + 15) + UNDRILLED_PENALTY_HOURS * 60;
  const lossMin = path.rpo_minutes == null ? 30 : path.rpo_minutes;
  if (path.name.startsWith("Cross-Region read replica")) d.replica = null; // promoted: it is the database now, not a replica
  d.activeRegion = d.drRegion;
  d.backupReplication = null; // replication pointed the other way; set it up again from the new Region
  return { hours: Math.max(1, Math.ceil(minutes / 60)), lossMin, drilled };
}
