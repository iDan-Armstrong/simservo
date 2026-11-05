// Player actions. Every action is the fix rdsops recommends for a finding, and shows
// the real command or console step it stands for. `hours` is game time the operator is
// busy; `cost` is one-time dollars; recurring cost shows up through monthlyCost().

import { GIB, INSTANCE_CLASSES } from "./engine.js";

const ev = (f) => f.evidence || {};
const findTable = (s, name) => s.db.tables.find((t) => `${t.schema}.${t.table}` === name);
const pidsOf = (f) => ev(f).pids || [];

const UPSIZE = { "db.t4g.micro": "db.t4g.small", "db.t4g.small": "db.t4g.medium", "db.t4g.medium": "db.m7g.large" };

export const ACTIONS = {
  HLT001: [
    {
      id: "tune_pools", label: "Lower ArcGIS Server service max instances", hours: 1, cost: 0,
      command: () => "ArcGIS Server Manager > Services > (service) > Pooling: lower max instances per machine",
      apply(s) { s.db.baseConnections = Math.max(8, s.db.baseConnections - 6); s.db.extraConnections = Math.max(0, s.db.extraConnections - 40); },
    },
    {
      id: "scale_up", label: "Scale up the instance class", hours: 1, cost: 0,
      available: (s) => Boolean(UPSIZE[s.instance.cls]),
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --db-instance-class ${UPSIZE[s.instance.cls]} --apply-immediately`,
      apply(s) { s.instance.cls = UPSIZE[s.instance.cls]; },
    },
  ],
  HLT002: [
    {
      id: "cancel_query", label: "Cancel the long-running query", hours: 0, cost: 0,
      command: (f) => pidsOf(f).map((p) => `SELECT pg_cancel_backend(${p});`).join(" "),
      apply(s, f) { const p = new Set(pidsOf(f)); s.db.sessions = s.db.sessions.filter((x) => !p.has(x.pid)); },
    },
  ],
  HLT003: [
    {
      id: "terminate_idle", label: "Terminate the idle-in-transaction session", hours: 0, cost: 0,
      command: (f) => pidsOf(f).map((p) => `SELECT pg_terminate_backend(${p});`).join(" "),
      apply(s, f) { const p = new Set(pidsOf(f)); s.db.sessions = s.db.sessions.filter((x) => !p.has(x.pid)); s.counters.terminated = (s.counters.terminated || 0) + 1; },
    },
  ],
  HLT004: [
    {
      id: "terminate_blocker", label: "Terminate the blocking session", hours: 0, cost: 0,
      command: () => "SELECT pg_terminate_backend(b) FROM pg_stat_activity, unnest(pg_blocking_pids(pid)) b;",
      apply(s) { s.db.sessions = s.db.sessions.filter((x) => !x.blocks && !x.waiting); },
    },
  ],
  HLT005: [
    {
      id: "vacuum_freeze", label: "VACUUM (FREEZE) the oldest tables", hours: 2, cost: 0,
      command: () => "SELECT relname, age(relfrozenxid) FROM pg_class ORDER BY 2 DESC LIMIT 5; VACUUM (FREEZE, VERBOSE) <table>;",
      apply(s) { s.db.xidAge = 40_000_000; },
    },
  ],
  HLT006: [
    {
      id: "drop_slot", label: "Drop the orphaned replication slot", hours: 0, cost: 0,
      command: (f) => `SELECT pg_drop_replication_slot('${(f.title.match(/slot (\S+):/) || [])[1]}');`,
      apply(s, f) {
        const name = (f.title.match(/slot (\S+):/) || [])[1];
        s.db.slots = s.db.slots.filter((x) => x.name !== name);
        s.counters.slotsDropped = (s.counters.slotsDropped || 0) + 1;
        if (s.instance.status === "storage-full") s.instance.status = "available";
      },
    },
  ],
  HLT008: [
    {
      id: "custom_params", label: "Attach the custom parameter group (reboot)", hours: 1, cost: 0,
      command: (f, s) => `terraform apply  # module egdb-postgres: parameter group with pg_stat_statements and pgaudit; then aws rds reboot-db-instance --db-instance-identifier ${s.instance.identifier}`,
      apply(s) { s.instance.customParams = true; },
    },
  ],
  HLT010: [
    {
      id: "grow_storage", label: "Add 20 GB of storage (cannot shrink later)", hours: 1, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --allocated-storage ${s.instance.allocatedGb + 20} --apply-immediately`,
      apply(s) { s.instance.allocatedGb += 20; if (s.instance.status === "storage-full") s.instance.status = "available"; },
    },
    {
      id: "autoscale", label: "Turn on storage autoscaling (to 100 GB)", hours: 0, cost: 0,
      available: (s) => !s.instance.maxAllocatedGb,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --max-allocated-storage 100`,
      apply(s) { s.instance.maxAllocatedGb = 100; },
    },
  ],
  MNT001: [
    {
      id: "vacuum", label: "VACUUM (ANALYZE) the table", hours: 1, cost: 0,
      command: (f) => `VACUUM (ANALYZE) ${ev(f).table};`,
      apply(s, f) {
        const t = findTable(s, ev(f).table);
        if (!t) return;
        const pinned = s.db.sessions.some((x) => x.state.startsWith("idle in transaction"));
        t.dead = pinned ? Math.round(t.dead * 0.9) : 0; // an open transaction still pins rows
        t.lastVacuum = s.tick; t.mod = 0; t.lastAnalyze = s.tick; t.neverVacuumed = false; t.neverAnalyzed = false;
        s.counters.vacuums = (s.counters.vacuums || 0) + 1;
      },
    },
  ],
  MNT002: [
    {
      id: "analyze", label: "ANALYZE the table", hours: 0, cost: 0,
      command: (f) => `ANALYZE ${ev(f).table};`,
      apply(s, f) { const t = findTable(s, ev(f).table); if (t) { t.mod = 0; t.lastAnalyze = s.tick; t.neverAnalyzed = false; } },
    },
  ],
  MNT003: [
    {
      id: "drop_unused", label: "Drop the unused index", hours: 0, cost: 0,
      command: (f) => `DROP INDEX CONCURRENTLY ${ev(f).index};`,
      apply(s, f) { s.db.unusedIndexes = s.db.unusedIndexes.filter((i) => `${i.schema}.${i.index}` !== ev(f).index); },
    },
  ],
  MNT004: [
    {
      id: "drop_duplicate", label: "Drop the duplicate index", hours: 0, cost: 0,
      command: (f) => { const d = ev(f).indexes || []; return d.length > 1 ? `DROP INDEX CONCURRENTLY ${d[1].split(" ")[2]};` : "DROP INDEX CONCURRENTLY <duplicate>;"; },
      apply(s) { s.db.duplicateIndexes = []; },
    },
  ],
  MNT005: [
    {
      id: "rebuild_invalid", label: "Drop the invalid index and rebuild it", hours: 1, cost: 0,
      command: (f) => `DROP INDEX CONCURRENTLY ${f.title.split(" ")[2]}; -- fix the duplicate values, then CREATE UNIQUE INDEX CONCURRENTLY ...`,
      apply(s) { s.db.invalidIndexes = []; },
    },
  ],
  MNT006: [
    {
      id: "gist", label: "Build a GiST spatial index", hours: 1, cost: 0,
      command: (f) => `CREATE INDEX CONCURRENTLY ON ${ev(f).table} USING GIST (${ev(f).column});`,
      apply(s, f) { const t = findTable(s, ev(f).table); if (t) t.hasGist = true; s.counters.gist = (s.counters.gist || 0) + 1; },
    },
  ],
  INV002: [
    {
      id: "close_public", label: "Turn off public accessibility", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --no-publicly-accessible --apply-immediately`,
      apply(s) { s.instance.public = false; },
    },
  ],
  INV003: [
    {
      id: "deletion_protection", label: "Turn on deletion protection", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --deletion-protection`,
      apply(s) { s.instance.deletionProtection = true; },
    },
  ],
  INV004: [
    {
      id: "retention", label: "Keep 7 days of backups", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --backup-retention-period 7`,
      apply(s) { s.instance.backupRetention = 7; },
    },
  ],
  INV005: [
    {
      id: "iam_auth", label: "Enable IAM database authentication", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --enable-iam-database-authentication`,
      apply(s) { s.instance.iamAuth = true; },
    },
  ],
  INV006: [
    {
      id: "multi_az", label: "Add a Multi-AZ standby (doubles instance cost)", hours: 2, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --multi-az --apply-immediately`,
      apply(s) { s.instance.multiAz = true; },
    },
  ],
  INV007: [
    {
      id: "perf_insights", label: "Turn on Performance Insights", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --enable-performance-insights`,
      apply(s) { s.instance.perfInsights = true; },
    },
  ],
  INV008: [
    {
      id: "no_auto_minor", label: "Turn off auto minor upgrades (patch via the runbook)", hours: 0, cost: 0,
      command: (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --no-auto-minor-version-upgrade`,
      apply(s) { s.instance.autoMinor = false; },
    },
  ],
  INV009: [
    {
      id: "custom_params_inv", label: "Attach the custom parameter group (reboot)", hours: 1, cost: 0,
      command: (f, s) => `terraform apply  # module egdb-postgres; then aws rds reboot-db-instance --db-instance-identifier ${s.instance.identifier}`,
      apply(s) { s.instance.customParams = true; },
    },
  ],
  CMP002: [
    {
      id: "minor_upgrade", label: "Apply the certified minor version", hours: 2, cost: 0,
      command: (f, s) => `rdsops upgrade-plan --instance ${s.instance.identifier} --target ${ev(f).certified_minimum} --arcgis ${s.instance.arcgis}`,
      apply(s, f) { s.instance.engineVersion = ev(f).certified_minimum; },
    },
  ],
  CMP003: [
    {
      id: "restore_pre_patch", label: "Restore the pre-patch snapshot", hours: 4, cost: 0,
      available: (s) => s.instance.backupRetention > 0,
      command: (f, s) => `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier ${s.instance.identifier} --target-db-instance-identifier ${s.instance.identifier}-restored --restore-time <before the window>`,
      apply(s) { s.instance.engineVersion = "17.7"; s.instance.postgis = "3.5.2"; s.instance.autoMinor = false; },
    },
  ],
};

const ONE_DAY = 24;
const site = (s) => s.arcgis;

Object.assign(ACTIONS, {
  SRV001: [
    {
      id: "start_all_machines", label: "Start ArcGIS Server on every machine", hours: 1, cost: 0,
      available: (s) => site(s).licensed,
      command: () => "Windows: Start-Service 'ArcGIS Server'   Linux: <install>/startserver.sh",
      apply(s) { for (const m of site(s).machines) { m.realtime = "STARTED"; m.configured = "STARTED"; } },
    },
  ],
  SRV002: [
    {
      id: "authorize", label: "Authorize with the renewed license file", hours: 1, cost: 0,
      command: () => "<install>/tools/authorizeSoftware -f renewed.ecp, then restart ArcGIS Server",
      apply(s) {
        const a = site(s);
        for (const l of a.licenses) l.expiresTick = s.tick + 365 * ONE_DAY;
        a.licensed = true;
        for (const m of a.machines) { m.realtime = "STARTED"; m.configured = "STARTED"; }
        s.counters.licenseRenewals = (s.counters.licenseRenewals || 0) + 1;
      },
    },
  ],
  SRV003: [
    {
      id: "start_machine", label: "Start the machine", hours: 0, cost: 0,
      available: (s) => site(s).licensed,
      command: (f, s) => `POST https://${site(s).host}/arcgis/admin/machines/${(f.evidence || {}).machine}/start  (or Start-Service 'ArcGIS Server' on the host)`,
      apply(s, f) {
        const m = site(s).machines.find((x) => x.name === (f.evidence || {}).machine);
        if (m) { m.realtime = "STARTED"; m.configured = "STARTED"; }
        s.counters.machinesStarted = (s.counters.machinesStarted || 0) + 1;
      },
    },
  ],
  SRV004: [
    {
      id: "renew_license", label: "Renew the license from My Esri and authorize", hours: 1, cost: 0,
      command: () => "My Esri > Licensing > download the .ecp, then authorizeSoftware -f <file>.ecp",
      apply(s) {
        const a = site(s);
        for (const l of a.licenses) l.expiresTick = Math.max(l.expiresTick, s.tick + 365 * ONE_DAY);
        s.counters.licenseRenewals = (s.counters.licenseRenewals || 0) + 1;
      },
    },
  ],
  SRV005: [
    {
      id: "renew_cert", label: "Renew the CA-signed certificate and import it", hours: 1, cost: 40,
      command: (f, s) => `Import the new certificate on the web adaptor host (IIS / Tomcat) for ${site(s).host}, then update the site's SSL certificate`,
      apply(s) { const c = site(s).cert; c.notAfterTick = s.tick + 200 * ONE_DAY; c.trusted = true; c.issuer = "CN=Example Issuing CA, O=Example CA"; },
    },
  ],
  SRV006: [
    {
      id: "replace_self_signed", label: "Replace the self-signed certificate with a CA-signed one", hours: 1, cost: 40,
      command: (f, s) => `Request a certificate for ${site(s).host} from your CA, import it on the web adaptor host, and bind it to 443`,
      apply(s) {
        const c = site(s).cert;
        c.trusted = true; c.issuer = "CN=Example Issuing CA, O=Example CA"; c.notAfterTick = s.tick + 200 * ONE_DAY;
        s.counters.trustedCert = (s.counters.trustedCert || 0) + 1;
      },
    },
  ],
  SVC001: [
    {
      id: "start_service", label: "Start the service", hours: 0, cost: 0,
      available: (s) => site(s).machines.some((m) => m.realtime === "STARTED"),
      command: (f, s) => `POST https://${site(s).host}/arcgis/admin/services/${(f.evidence || {}).service}/start`,
      apply(s, f) {
        const name = (f.evidence || {}).service;
        const x = site(s).services.find((v) => `${v.folder}/${v.name}.${v.type}` === name);
        if (x) { x.realtime = "STARTED"; x.configured = "STARTED"; }
        s.counters.servicesStarted = (s.counters.servicesStarted || 0) + 1;
      },
    },
  ],
  SVC003: [
    {
      id: "raise_max_instances", label: "Raise max instances per machine by 2", hours: 0, cost: 0,
      command: (f, s) => `ArcGIS Server Manager > ${(f.evidence || {}).service} > Pooling: maximum instances ${((f.evidence || {}).max || 0) + 2} (POST .../edit with the new maxInstancesPerNode)`,
      apply(s, f) {
        const name = (f.evidence || {}).service;
        const x = site(s).services.find((v) => `${v.folder}/${v.name}.${v.type}` === name);
        if (x) x.max += 2;
        s.counters.poolsTuned = (s.counters.poolsTuned || 0) + 1;
      },
    },
  ],
});

export function actionsFor(finding, s) {
  return (ACTIONS[finding.code] || []).filter((a) => !a.available || a.available(s));
}

// Upgrades offered in the shop regardless of current findings.
export const UPGRADES = [
  { id: "shop_multi_az", label: "Multi-AZ standby", code: "INV006", minLevel: 5, has: (s) => s.instance.multiAz },
  { id: "shop_retention", label: "7-day backups", code: "INV004", minLevel: 2, has: (s) => s.instance.backupRetention >= 7 },
  { id: "shop_params", label: "Custom parameter group", code: "INV009", minLevel: 2, has: (s) => s.instance.customParams },
  { id: "shop_pi", label: "Performance Insights", code: "INV007", minLevel: 3, has: (s) => s.instance.perfInsights },
  { id: "shop_iam", label: "IAM database auth", code: "INV005", minLevel: 4, has: (s) => s.instance.iamAuth },
  { id: "shop_autoscale", label: "Storage autoscaling", code: "HLT010", action: "autoscale", minLevel: 4, has: (s) => Boolean(s.instance.maxAllocatedGb) },
  { id: "shop_scale", label: "Bigger instance class", code: "HLT001", action: "scale_up", minLevel: 5, has: (s) => s.instance.cls === "db.m7g.large" },
];

export function classInfo(cls) {
  return INSTANCE_CLASSES[cls];
}

export { GIB };
