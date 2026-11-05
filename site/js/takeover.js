// Expansion 2: The Takeover. A client, the Northwind Survey Agency (fictional), runs its
// own ArcGIS 12.1 site in AWS GovCloud (US) and wants its RDS geodatabase moved to Aurora
// PostgreSQL before your operations center takes it over.
//
// The game keeps the client's facts. The real rdsops aurora-plan decides what blocks the
// migration, and chapter one ends when it says the blockers are gone. After promotion the
// real rdsops compat (--platform aurora) checks the cluster.
//
// Steps follow AWS's Aurora read replica migration and the runbook in rds-geodatabase-ops.

import { ensureCampaign } from "./campaign.js";

const START = Date.UTC(2026, 0, 5, 6, 0, 0); // must match engine.js
const isoTick = (tick) => new Date(START + tick * 3600_000).toISOString().replace("Z", "+00:00");
const GIB = 1024 ** 3;
const REGION = "us-gov-west-1";
const ACCOUNT = "210987654321";
const TARGET = "17.6";
export const RELEASE_DELAY = 72; // hours until AWS offers Esri's minimum in the client's Region

export const CHAPTERS = [
  { n: 1, title: "Due diligence", goal: "Clear what aurora-plan says blocks the migration" },
  { n: 2, title: "Replicate", goal: "Create the Aurora read replica and let it catch up" },
  { n: 3, title: "Cutover", goal: "Stop writes, promote, point ArcGIS at the cluster, add a reader" },
];

export function newTakeover() {
  return {
    started: null,
    chapter: 1,
    work: null,
    finished: false,
    clientDownHours: 0,
    client: {
      name: "Northwind Survey Agency",
      region: REGION,
      account: ACCOUNT, // made up
      source: {
        id: "nwsa-egdb", engineVersion: "17.5", postgis: "3.5.2",
        encrypted: false, multiAz: true, allocatedGb: 200, usedGb: 172,
        auroraReplicas: ["nwsa-aurora-try1"], crossRegion: [], retired: false,
      },
      regionAurora: ["16.8", "17.4", "17.5"],
      releaseTick: null,
      kmsKey: null,
      cluster: null, // { id, version, lagGb, walGb, state: replicating | caught-up | promoted, readers }
      writes: true,
      repointed: false,
    },
  };
}

export function ensureTakeover(s) {
  if (!s.takeover) s.takeover = newTakeover();
  return s.takeover;
}

const c = (s) => ensureTakeover(s).client;
const freeGb = (src, cl) => src.allocatedGb - src.usedGb - (cl && cl.state !== "promoted" ? cl.walGb : 0);

export const STEPS = {
  delete_try: {
    label: "Delete the abandoned Aurora cluster nwsa-aurora-try1", hours: 1, chapter: 1,
    command: `aws rds delete-db-instance --region ${REGION} --db-instance-identifier nwsa-aurora-try1-1 && aws rds delete-db-cluster --region ${REGION} --db-cluster-identifier nwsa-aurora-try1 --final-db-snapshot-identifier nwsa-aurora-try1-final`,
    blocked: (s) => (c(s).source.auroraReplicas.length ? null : "No abandoned Aurora cluster is left."),
    finish(s) { c(s).source.auroraReplicas = []; },
  },
  grow_storage: {
    label: "Raise the source's storage to 300 GB", hours: 1, chapter: 1,
    command: `aws rds modify-db-instance --region ${REGION} --db-instance-identifier nwsa-egdb --allocated-storage 300 --apply-immediately`,
    blocked: (s) => (c(s).source.allocatedGb >= 300 ? "Storage is already 300 GB." : null),
    finish(s) { c(s).source.allocatedGb = 300; },
  },
  kms_key: {
    label: "Create a customer-managed KMS key for the cluster", hours: 1, chapter: 1,
    command: `aws kms create-key --region ${REGION} --description "nwsa-egdb Aurora storage" && aws kms create-alias --region ${REGION} --alias-name alias/nwsa-egdb-aurora --target-key-id <key id>`,
    blocked: (s) => (c(s).kmsKey ? "The key already exists." : null),
    finish(s) { c(s).kmsKey = `arn:aws-us-gov:kms:${REGION}:${ACCOUNT}:key/7c1e2a90-4b3d-4f5e-9a10-2d6c8e4f1b77`; },
  },
  create_cluster: {
    label: `Create the Aurora read replica cluster (${TARGET}, encrypted)`, hours: 2, chapter: 2,
    command: `aws rds create-db-cluster --region ${REGION} --db-cluster-identifier nwsa-egdb-aurora --engine aurora-postgresql --engine-version ${TARGET} --replication-source-identifier arn:aws-us-gov:rds:${REGION}:${ACCOUNT}:db:nwsa-egdb --storage-encrypted --kms-key-id alias/nwsa-egdb-aurora && aws rds create-db-instance --region ${REGION} --db-cluster-identifier nwsa-egdb-aurora --db-instance-identifier nwsa-egdb-aurora-1 --db-instance-class db.r6g.large --engine aurora-postgresql`,
    blocked: (s) => (c(s).cluster ? "The cluster already exists." : null),
    finish(s) { c(s).cluster = { id: "nwsa-egdb-aurora", version: TARGET, lagGb: 150, walGb: 0, state: "replicating", readers: 0 }; },
  },
  stop_writes: {
    label: "Stop the client's ArcGIS services that write", hours: 0, chapter: 3,
    command: "Stop editing services and sync jobs on the client's ArcGIS Server (POST admin/services/<service>/stop); announce the window",
    blocked: (s) => (!c(s).writes ? "Writes are already stopped." : null),
    start(s) { c(s).writes = false; },
  },
  promote: {
    label: "Promote the Aurora cluster", hours: 1, chapter: 3,
    command: `Check pg_current_wal_lsn() on nwsa-egdb is behind pg_last_wal_replay_lsn() on the cluster, then aws rds promote-read-replica-db-cluster --region ${REGION} --db-cluster-identifier nwsa-egdb-aurora`,
    blocked: (s) =>
      c(s).writes ? "AWS: make sure nothing is writing to the source before promoting. Stop writes first."
      : !c(s).cluster || c(s).cluster.lagGb > 0 ? "Replica lag must be zero before promoting."
      : c(s).cluster.state === "promoted" ? "The cluster is already promoted." : null,
    finish(s) { const x = c(s); x.cluster.state = "promoted"; x.cluster.walGb = 0; x.source.retired = true; },
  },
  repoint: {
    label: "Point the client's data stores at the cluster", hours: 1, chapter: 3,
    command: "Update each registered data store (POST admin/data/items/<item>/edit) and .sde connection file to nwsa-egdb-aurora.cluster-<id>.us-gov-west-1.rds.amazonaws.com, then validate them",
    blocked: (s) => (!c(s).cluster || c(s).cluster.state !== "promoted" ? "Promote the cluster first." : c(s).repointed ? "Already done." : null),
    finish(s) { c(s).repointed = true; },
  },
  start_writes: {
    label: "Start the client's services and test editing", hours: 0, chapter: 3,
    command: "Start the stopped services (POST admin/services/<service>/start), then edit a feature and reconcile a version",
    blocked: (s) => (c(s).writes ? "Services are running." : !c(s).repointed ? "Point the data stores at the cluster first, or the services write to the old instance." : null),
    start(s) { c(s).writes = true; },
  },
  add_reader: {
    label: "Add an Aurora reader in a second AZ", hours: 1, chapter: 3,
    command: `aws rds create-db-instance --region ${REGION} --db-cluster-identifier nwsa-egdb-aurora --db-instance-identifier nwsa-egdb-aurora-2 --db-instance-class db.r6g.large --engine aurora-postgresql --availability-zone us-gov-west-1b`,
    blocked: (s) => (!c(s).cluster || c(s).cluster.state !== "promoted" ? "Add readers after promotion." : c(s).cluster.readers ? "A reader exists." : null),
    finish(s) { c(s).cluster.readers = 1; },
  },
};

export function takeoverUnlocked(s) {
  const exp1 = ensureCampaign(s);
  return s.level >= 14 && exp1.finished;
}

export function available(s, id) {
  const t = ensureTakeover(s);
  const step = STEPS[id];
  if (t.started == null || t.finished) return "The takeover is not running.";
  if (t.work) return "A takeover step is already in progress.";
  if (step.chapter > t.chapter) return "Finish the current chapter first.";
  return step.blocked(s);
}

export function startStep(s, id, log) {
  const why = available(s, id);
  if (why) return { ok: false, reason: why };
  const step = STEPS[id];
  const t = s.takeover;
  if (step.start) step.start(s);
  log({ kind: "action", text: `$ ${step.command}` });
  if (step.hours > 0) t.work = { id, until: s.tick + step.hours };
  else if (step.finish) step.finish(s);
  return { ok: true };
}

// The client's world moves on: AWS ships versions, the replica catches up, WAL piles up.
export function takeoverTick(s, log) {
  const t = ensureTakeover(s);
  const events = [];
  if (t.started == null || t.finished) return events;
  const x = t.client;
  if (x.releaseTick != null && s.tick >= x.releaseTick && !x.regionAurora.includes(TARGET)) {
    x.regionAurora.push(TARGET);
    log({ kind: "info", text: `AWS released Aurora PostgreSQL ${TARGET} in ${REGION}.` });
  }
  if (t.work && s.tick >= t.work.until) {
    const step = STEPS[t.work.id];
    if (step.finish) step.finish(s);
    log({ kind: "info", text: `Client: ${step.label}, done.` });
    t.work = null;
  }
  const cl = x.cluster;
  if (cl && cl.state !== "promoted") {
    if (x.writes) cl.walGb = Math.round((cl.walGb + 0.6) * 10) / 10; // WAL kept for the replica
    cl.lagGb = Math.max(0, cl.lagGb - 25);
    if (cl.lagGb === 0 && cl.state === "replicating") {
      cl.state = "caught-up";
      log({ kind: "info", text: "Client: the Aurora replica has caught up (RDSToAuroraPostgreSQLReplicaLag 0)." });
    }
    if (freeGb(x.source, cl) <= 0) log({ kind: "outage", text: "Client: nwsa-egdb is out of storage. Writes are failing." });
  }
  if (!x.writes) t.clientDownHours += 1;
  if (t.chapter === 2 && cl && cl.state === "caught-up") {
    t.chapter = 3;
    events.push({ chapter: 3 });
  }
  return events;
}

// Chapter one ends when the real aurora-plan, run on the client's facts, has cleared the
// target version, the method and the WAL headroom, and the cluster has a KMS key. The
// unencrypted source stays a failure until it is replaced; that is the point of the move.
export function checkProgress(s, findings) {
  const t = ensureTakeover(s);
  if (t.started == null || t.finished) return null;
  const sev = (code) => (findings.find((f) => f.source === "aurora-plan" && f.code === code) || {}).severity;
  if (t.chapter === 1 && ["OK", "INFO"].includes(sev("AUR001")) && sev("AUR002") === "OK" && sev("AUR005") === "OK" && t.client.kmsKey) {
    t.chapter = 2;
    return { chapter: 2 };
  }
  const x = t.client;
  if (t.chapter === 3 && x.repointed && x.writes && x.cluster.readers && !t.work) {
    const cmp = findings.filter((f) => f.source === "client-compat");
    if (cmp.length && !cmp.some((f) => f.severity === "WARN" || f.severity === "FAIL")) {
      t.finished = true;
      t.finishedTick = s.tick;
      return { finale: true };
    }
  }
  return null;
}

// Same field names as rdsops.aurora.AuroraFacts / AuroraRequest, until the cluster is
// promoted; then the cluster's version for rdsops compat --platform aurora.
export function takeoverSnapshot(s) {
  const t = ensureTakeover(s);
  if (t.started == null) return undefined;
  const x = t.client;
  if (x.cluster && x.cluster.state === "promoted") {
    return { compat: { engine_version: x.cluster.version, arcgis: "12.1", postgis_version: x.source.postgis, platform: "aurora" } };
  }
  const src = x.source;
  return {
    plan: {
      facts: {
        source: src.id, region: x.region, engine_version: src.engineVersion, account: ACCOUNT,
        postgis_version: src.postgis, encrypted: src.encrypted,
        kms_key_id: null, multi_az: src.multiAz,
        aurora_replica_clusters: src.auroraReplicas, cross_region_replicas: src.crossRegion,
        allocated_gb: src.allocatedGb, free_bytes: Math.round(freeGb(src, x.cluster) * GIB),
        subnet_group: "nwsa-private", security_groups: ["sg-0nwsa"],
        aurora_versions: x.regionAurora,
      },
      request: { arcgis: "12.1", method: "replica", cluster: "nwsa-egdb-aurora" },
      now: isoTick(s.tick),
    },
  };
}

export function startTakeover(s) {
  const t = ensureTakeover(s);
  if (t.started != null) return false;
  t.started = s.tick;
  t.client.releaseTick = s.tick + RELEASE_DELAY;
  return true;
}

export { freeGb, TARGET, REGION };
