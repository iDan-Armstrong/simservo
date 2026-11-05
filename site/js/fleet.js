// Fleet: after The Takeover, your operations center runs more than one database. Sites
// join over time, each with its own problems. The real rdsops fleet scores all of them
// together: the inventory posture check and Esri compat per instance, plus drift across
// the fleet. Names and agencies are made up.
//
// rdsops fleet covers RDS for PostgreSQL instances only, so the client's Aurora cluster is
// not in it (rdsops ADR 0002 and 0007); their RDS test instance is.

import { ensureTakeover } from "./takeover.js";

export const ARRIVAL_EVERY = 96; // game hours between new sites
const INCOME_PER_SITE = 1.5; // $ per game hour for each site under contract
const PENALTY_PER_FAIL = 1.0; // $ per game hour for each failing site

// Certified minors per ArcGIS release, for the "patch" action. The real compat check in
// rdsops decides whether the result is right.
const CERTIFIED = {
  "12.1": { 14: "14.20", 15: "15.15", 16: "16.11", 17: "17.7", 18: "18.1" },
  "11.5": { 13: "13.20", 14: "14.17", 15: "15.12", 16: "16.8" },
};

const BASE = {
  engineVersion: "17.7", cls: "db.t4g.medium", allocatedGb: 100,
  public: false, encrypted: true, deletionProtection: true, backupRetention: 7,
  iamAuth: true, autoMinor: false, multiAz: false, customParams: true, perfInsights: true,
  arcgis: "12.1", production: false,
};

// Sites that join, in order. Each brings the kind of mess real inherited databases have.
export const ARRIVALS = [
  { id: "parks-egdb", owner: "Lakeshore Parks District", region: "us-east-1",
    engineVersion: "17.5", public: true, backupRetention: 1, customParams: false, iamAuth: false },
  { id: "utilities-egdb", owner: "Ridgeview Utilities", region: "us-east-1",
    engineVersion: "16.8", production: true, deletionProtection: false, autoMinor: true },
  { id: "harbor-egdb", owner: "Harbor Port Authority", region: "us-east-2",
    encrypted: false, arcgis: null, perfInsights: false },
  { id: "nwsa-egdb-dr", owner: "Northwind Survey Agency", region: "us-gov-east-1",
    engineVersion: "17.5", production: true, arcgis: null, backupRetention: 3 },
  { id: "transit-egdb", owner: "Metro Transit", region: "us-west-2",
    engineVersion: "16.6", arcgis: "11.5", public: true, deletionProtection: false },
  { id: "schools-egdb", owner: "Valley School District", region: "us-west-2",
    engineVersion: "15.12", customParams: false, autoMinor: true, backupRetention: 0 },
];

export function ensureFleet(s) {
  if (!s.fleet) s.fleet = { started: null, members: [], nextArrival: null, arrived: 0, cleanStreak: 0 };
  return s.fleet;
}

export function fleetUnlocked(s) {
  return Boolean(s.takeover && s.takeover.finished);
}

function member(spec) {
  return { ...BASE, ...spec, work: null };
}

export function startFleet(s) {
  const f = ensureFleet(s);
  if (f.started != null || !fleetUnlocked(s)) return false;
  f.started = s.tick;
  f.members.push(member({ id: "nwsa-egdb-test", owner: "Northwind Survey Agency", region: "us-gov-west-1",
    engineVersion: "16.6", arcgis: null, allocatedGb: 50 }));
  f.nextArrival = s.tick + ARRIVAL_EVERY / 2;
  return true;
}

// One game hour: arrivals, work finishing, contract money.
export function fleetTick(s, log, failing = 0) {
  const f = ensureFleet(s);
  if (f.started == null) return [];
  const events = [];
  if (f.arrived < ARRIVALS.length && s.tick >= f.nextArrival) {
    const spec = ARRIVALS[f.arrived++];
    f.members.push(member(spec));
    f.nextArrival = s.tick + ARRIVAL_EVERY;
    log({ kind: "scenario", text: `New site: ${spec.owner} hands you ${spec.id} in ${spec.region}.` });
    events.push({ arrival: spec.id });
  }
  for (const m of f.members) {
    if (m.work && s.tick >= m.work.until) {
      FIXES[m.work.id].apply(m);
      log({ kind: "info", text: `${m.id}: ${FIXES[m.work.id].label}, done.` });
      m.work = null;
    }
  }
  s.budget += f.members.length * INCOME_PER_SITE - failing * PENALTY_PER_FAIL;
  return events;
}

export const FIXES = {
  baseline: {
    label: "Apply the baseline (Terraform module)", hours: 2,
    when: (m) => m.public || !m.deletionProtection || m.backupRetention < 7 || !m.iamAuth || m.autoMinor || !m.customParams || !m.perfInsights,
    command: (m) => `terraform apply -target=module.${m.id.replace(/-/g, "_")}  (egdb-postgres module: private, deletion protection, 7-day backups, IAM auth, custom parameter group, Performance Insights, minor upgrades gated)`,
    apply(m) { Object.assign(m, { public: false, deletionProtection: true, backupRetention: Math.max(7, m.backupRetention), iamAuth: true, autoMinor: false, customParams: true, perfInsights: true }); },
  },
  patch: {
    label: "Patch to the certified minor", hours: 1,
    when: (m) => {
      const want = (CERTIFIED[m.arcgis || "12.1"] || {})[m.engineVersion.split(".")[0]];
      return Boolean(want) && want !== m.engineVersion;
    },
    command: (m) => `aws rds modify-db-instance --region ${m.region} --db-instance-identifier ${m.id} --engine-version ${(CERTIFIED[m.arcgis || "12.1"] || {})[m.engineVersion.split(".")[0]]} --apply-immediately`,
    apply(m) { m.engineVersion = CERTIFIED[m.arcgis || "12.1"][m.engineVersion.split(".")[0]]; },
  },
  tag: {
    label: "Tag its ArcGIS release (12.1)", hours: 0,
    when: (m) => !m.arcgis,
    command: (m) => `aws rds add-tags-to-resource --region ${m.region} --resource-name ${arn(m)} --tags Key=arcgis-release,Value=12.1`,
    apply(m) { m.arcgis = "12.1"; },
  },
  multi_az: {
    label: "Turn on Multi-AZ", hours: 1,
    when: (m) => !m.multiAz && m.production,
    command: (m) => `aws rds modify-db-instance --region ${m.region} --db-instance-identifier ${m.id} --multi-az --apply-immediately`,
    apply(m) { m.multiAz = true; },
  },
  encrypt: {
    label: "Encrypt: snapshot, copy with KMS, restore, cut over", hours: 6,
    when: (m) => !m.encrypted,
    command: (m) => `aws rds create-db-snapshot ... ; aws rds copy-db-snapshot --region ${m.region} --kms-key-id alias/${m.id} ... ; aws rds restore-db-instance-from-db-snapshot ...  (writes stop for the cutover)`,
    apply(m) { m.encrypted = true; },
  },
};

const partition = (region) => (region.startsWith("us-gov-") ? "aws-us-gov" : "aws");
const arn = (m) => `arn:${partition(m.region)}:rds:${m.region}:<account>:db:${m.id}`;

export function startFix(s, memberId, fixId, log) {
  const f = ensureFleet(s);
  const m = f.members.find((x) => x.id === memberId);
  const fix = FIXES[fixId];
  if (!m || !fix) return { ok: false, reason: "No such site or fix." };
  if (m.work) return { ok: false, reason: `${m.id} is already being worked on.` };
  if (!fix.when(m)) return { ok: false, reason: "Nothing to do there." };
  log({ kind: "action", text: `$ ${fix.command(m)}` });
  if (fix.hours > 0) m.work = { id: fixId, until: s.tick + fix.hours };
  else fix.apply(m);
  return { ok: true };
}

// Same field names as rdsops.fleet.FleetSnapshot (members carry InstanceFacts fields).
// Your own instance is first, read from the live game state.
export function fleetSnapshot(s, own) {
  const f = ensureFleet(s);
  if (f.started == null) return undefined;
  const facts = (m) => ({
    identifier: m.id, engine: "postgres", engine_version: m.engineVersion,
    instance_class: m.cls, status: "available",
    endpoint: `${m.id}.c0ffee.${m.region}.rds.amazonaws.com`, port: 5432,
    multi_az: m.multiAz, publicly_accessible: m.public, storage_encrypted: m.encrypted,
    kms_key_id: m.encrypted ? `alias/${m.id}` : null, deletion_protection: m.deletionProtection,
    backup_retention_days: m.backupRetention, iam_auth: m.iamAuth,
    auto_minor_version_upgrade: m.autoMinor, performance_insights: m.perfInsights,
    parameter_groups: [m.customParams ? `${m.id}-pg-custom` : `default.postgres${m.engineVersion.split(".")[0]}`],
    ca_cert: "rds-ca-rsa2048-g1", allocated_storage_gb: m.allocatedGb, max_allocated_storage_gb: null,
    managed_master_secret: true,
  });
  const members = [
    { region: "us-east-1", facts: own.facts, arcgis: "12.1", production: own.production },
    ...f.members.map((m) => ({ region: m.region, facts: facts(m), arcgis: m.arcgis, production: m.production })),
  ];
  return {
    members,
    regions: [...new Set(members.map((m) => m.region))],
    default_arcgis: "12.1",
    errors: [],
  };
}

export { CERTIFIED };
