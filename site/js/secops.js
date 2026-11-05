// Tier 8: Security Operations.
//
// Two halves, both driven by the real tools:
// - Posture. The game keeps security settings for your database and your ArcGIS site.
//   The real rdsops security and egisops security score them (sources "security" and
//   "arcgis-security"), and each finding has a fix like any other.
// - Incidents. Weak settings draw attacks. When one lands, the real rdsops incident or
//   egisops incident builds the playbook for it, filled in from the game's state. You
//   pick the steps in the order you think is right; the game keeps an incident clock and
//   scores the order with rules taken from the playbook itself:
//     * a step that destroys evidence before the evidence the playbook keeps ahead of it
//       is lost evidence,
//     * recovering before containment lets the attacker back in,
//     * a federal client's CISA report is due within one hour of identification,
//     * the review comes last.
//   Contingencies (twists) fire when the situation calls for them and add steps: the
//   attacker's open session, a second open rule, a deleted instance, a CA rotation that
//   breaks ArcGIS, a key used in another Region, and more.
//
// Names, accounts and sites are made up. Nothing here touches a real system.

export const UNLOCK_LEVEL = 15;
const DAY = 24;

export const RDSOPS_KINDS = ["credentials", "aws-keys", "exposure", "destruction", "exfiltration", "certificate"];
export const EGISOPS_KINDS = ["admin-account", "token", "exposed-service", "content", "host"];

// Incident minutes each step takes, by phase.
export const MINUTES = { Triage: 5, Notify: 10, Contain: 15, Preserve: 20, Eradicate: 30, Recover: 45, Learn: 5 };
// Dollars of impact per incident minute until the incident is contained.
const RATE = {
  credentials: 5, "aws-keys": 7, exposure: 4, destruction: 6, exfiltration: 8, certificate: 3,
  "admin-account": 6, token: 3, "exposed-service": 3, content: 5, host: 6,
};
export const CISA_MINUTES = 60;
const DESTROYS = /rotate|reset|restore-db|restore to|--import|rebuild|pg_terminate|\\password|terminate-instances|undo what|remove what|reinstall/i;
const CLIENT = { name: "Northwind Survey Agency", instance: "nwsa-egdb", region: "us-gov-west-1", site: "https://gis.nwsa.example" };

export function newSecops() {
  return {
    started: null,
    nextAt: null,
    incident: null,
    history: [],
    db: {
      forceSsl: "0", tlsMin: "TLSv1.1", pwEnc: "md5", accepted: "md5+scram", md5Roles: ["sde", "gis_editor"],
      ca: "rds-ca-rsa2048-g1", certTill: null, logExports: [], pgaudit: false, logConnections: "0",
      openRule: true, snapshots: [{ id: "egdb-lab-before-upgrade", encrypted: true, public: false, accounts: ["444455556666"] }],
      kmsCustomer: true, kmsRotation: false, secretRotation: false, superusers: ["gis_admin"], publicCreate: true, nonSsl: 4,
    },
    site: {
      protocol: "HTTP_AND_HTTPS", tls: ["TLSv1.1", "TLSv1.2", "TLSv1.3"], hsts: false, direct: true, vdirs: false,
      tokenGet: true, tokenPostQuery: false, psaDisabled: false, sq: true, legacy: true, sdir: true, origins: "*",
    },
  };
}

export function ensureSecops(s) {
  if (!s.secops) s.secops = newSecops();
  return s.secops;
}

export function secopsUnlocked(s) {
  return s.level >= UNLOCK_LEVEL;
}

export function startSecops(s) {
  const x = ensureSecops(s);
  if (x.started != null || !secopsUnlocked(s)) return false;
  x.started = s.tick;
  x.db.certTill = s.tick + 20 * DAY; // the server certificate runs out in 20 days
  x.nextAt = s.tick + 12; // the first attack comes soon, while you are still reading
  return true;
}

// ------------------------------------------------------------------ snapshots
// Same field names as rdsops.security.SecuritySnapshot and egisops.security.ServerSecurity.

export function securitySnapshot(s, facts, isoAt) {
  const x = s.secops;
  if (!x || x.started == null) return undefined;
  const d = x.db;
  const inst = s.instance;
  return {
    rds: {
      facts,
      region: "us-east-1",
      ca_identifier: d.ca,
      cert_valid_till: d.certTill == null ? null : isoAt(d.certTill),
      params: {
        "rds.force_ssl": d.forceSsl,
        ssl_min_protocol_version: d.tlsMin,
        password_encryption: d.pwEnc,
        "rds.accepted_password_auth_method": d.accepted,
        shared_preload_libraries: d.pgaudit ? "pg_stat_statements,pgaudit" : "pg_stat_statements",
        "pgaudit.log": d.pgaudit ? "ddl,role" : null,
        log_connections: d.logConnections,
      },
      log_exports: d.logExports,
      ingress: inst.public && d.openRule ? [{ group: "sg-0egdblab", from_port: 5432, to_port: 5432, cidr: "0.0.0.0/0" }] : [],
      snapshots: d.snapshots.map((n) => ({ identifier: n.id, encrypted: n.encrypted, public: n.public, accounts: n.accounts })),
      kms_customer_managed: inst.encrypted ? d.kmsCustomer : null,
      kms_rotation: inst.encrypted ? d.kmsRotation : null,
      secret_rotation: inst.managedSecret ? d.secretRotation : null,
      non_ssl_connections: d.forceSsl === "1" ? 0 : d.nonSsl,
      md5_roles: d.md5Roles,
      superuser_members: d.superusers,
      public_schema_create: d.publicCreate,
    },
    server: {
      base_url: `https://${s.arcgis.host}/server`,
      protocol: x.site.protocol,
      https_protocols: x.site.tls,
      hsts: x.site.hsts,
      direct_access: x.site.direct,
      virtual_dirs_secured: x.site.vdirs,
      admin_ips: null,
      token_get: x.site.tokenGet,
      token_post_query: x.site.tokenPostQuery,
      psa_disabled: x.site.psaDisabled,
      standardized_queries: x.site.sq,
      legacy_url_parser: x.site.legacy,
      services_directory: x.site.sdir,
      allowed_origins: x.site.origins,
      web_adaptors: [`https://${s.arcgis.host}/server`],
    },
  };
}

// ------------------------------------------------------------------ posture fixes
// Keyed by finding code like actions.js; `title` picks which of a code's findings.

const has = (f, re) => re.test(f.title || "");
const fix = (id, label, hours, command, apply, when = () => true) => ({ id, label, hours, cost: 0, command, apply, available: (s, f) => !f || when(f) });

export const SEC_ACTIONS = {
  SEC001: [fix("force_ssl", "Require TLS (rds.force_ssl = 1)", 0,
    () => "aws rds modify-db-parameter-group --db-parameter-group-name egdb-lab-pg17-custom --parameters ParameterName=rds.force_ssl,ParameterValue=1,ApplyMethod=immediate",
    (s) => { s.secops.db.forceSsl = "1"; s.secops.db.nonSsl = 0; })],
  SEC002: [fix("tls12", "Minimum TLS 1.2", 0,
    () => "aws rds modify-db-parameter-group --db-parameter-group-name egdb-lab-pg17-custom --parameters ParameterName=ssl_min_protocol_version,ParameterValue=TLSv1.2,ApplyMethod=immediate",
    (s) => { s.secops.db.tlsMin = "TLSv1.2"; })],
  SEC003: [fix("scram", "Reset md5 roles with SCRAM, then refuse md5", 1,
    (f, s) => `SET password_encryption = 'scram-sha-256'; ${s.secops.db.md5Roles.map((r) => `\\password ${r}`).join("; ") || "(no md5 roles left)"}; then rds.accepted_password_auth_method = scram`,
    (s) => { const d = s.secops.db; d.md5Roles = []; d.pwEnc = "scram-sha-256"; d.accepted = "scram"; })],
  SEC004: [fix("rotate_ca", "Update client trust, then rotate the certificate", 1,
    (f, s) => `Install the RDS CA bundle on ArcGIS Server machines; aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --ca-certificate-identifier rds-ca-rsa2048-g1 --apply-immediately`,
    (s) => { s.secops.db.ca = "rds-ca-rsa2048-g1"; s.secops.db.certTill = s.tick + 365 * DAY; })],
  SEC005: [fix("close_sg", "Remove 0.0.0.0/0 from the security group", 0,
    () => "aws ec2 revoke-security-group-ingress --group-id sg-0egdblab --protocol tcp --port 5432 --cidr 0.0.0.0/0",
    (s) => { s.secops.db.openRule = false; })],
  SEC006: [fix("private_snaps", "Make manual snapshots private and unshared", 0,
    (f, s) => s.secops.db.snapshots.map((n) => `aws rds modify-db-snapshot-attribute --db-snapshot-identifier ${n.id} --attribute-name restore --values-to-remove all ${n.accounts.join(" ")}`).join("; "),
    (s) => { for (const n of s.secops.db.snapshots) { n.public = false; n.accounts = []; } })],
  SEC007: [fix("kms_rotation", "Turn on KMS key rotation", 0,
    () => "aws kms enable-key-rotation --key-id alias/egdb-lab-db",
    (s) => { s.secops.db.kmsRotation = true; })],
  SEC008: [fix("secret_rotation", "Rotate the managed master secret on a schedule", 0,
    (f, s) => `aws secretsmanager rotate-secret --secret-id <rds!db-${s.instance.identifier} secret> --rotation-rules AutomaticallyAfterDays=7`,
    (s) => { s.instance.managedSecret = true; s.secops.db.secretRotation = true; })],
  SEC009: [fix("audit", "pgaudit, log_connections, export logs (reboot)", 1,
    (f, s) => `shared_preload_libraries += pgaudit, pgaudit.log = ddl,role, log_connections = 1 in egdb-lab-pg17-custom; aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --cloudwatch-logs-export-configuration EnableLogTypes=postgresql; aws rds reboot-db-instance`,
    (s) => { const d = s.secops.db; d.pgaudit = true; d.logConnections = "1"; d.logExports = ["postgresql"]; s.instance.customParams = true; })],
  SEC010: [fix("protect", "Deletion protection on, 7-day backups", 0,
    (f, s) => `aws rds modify-db-instance --db-instance-identifier ${s.instance.identifier} --deletion-protection --backup-retention-period 7 --apply-immediately`,
    (s) => { s.instance.deletionProtection = true; s.instance.backupRetention = Math.max(7, s.instance.backupRetention); })],
  SEC011: [
    fix("revoke_public", "Stop any role creating objects in public", 0, () => "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
      (s) => { s.secops.db.publicCreate = false; }, (f) => has(f, /public schema|CREATE/i)),
    fix("drop_super", "Remove extra rds_superuser members", 0, (f, s) => s.secops.db.superusers.map((r) => `REVOKE rds_superuser FROM ${r};`).join(" "),
      (s) => { s.secops.db.superusers = []; }, (f) => has(f, /superuser/i)),
    fix("force_ssl_sessions", "Require TLS (ends the non-TLS sessions)", 0, () => "rds.force_ssl = 1",
      (s) => { s.secops.db.forceSsl = "1"; s.secops.db.nonSsl = 0; }, (f) => has(f, /TLS|SSL/i)),
  ],
  ESC001: [
    fix("https_only", "HTTPS only", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/config/update Protocol=HTTPS`,
      (s) => { s.secops.site.protocol = "HTTPS"; }, (f) => has(f, /Protocol/)),
    fix("drop_tls11", "Remove TLS 1.0 and 1.1", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/config/update httpsProtocols=TLSv1.2,TLSv1.3`,
      (s) => { s.secops.site.tls = ["TLSv1.2", "TLSv1.3"]; }, (f) => has(f, /TLS versions/)),
    fix("hsts", "Turn on HSTS", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/config/update HSTSEnabled=true`,
      (s) => { s.secops.site.hsts = true; }, (f) => has(f, /HSTS/)),
  ],
  ESC002: [fix("no_legacy", "Turn off the legacy URL parser", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/system/properties/update properties={"allowLegacyURLParser":false}`,
    (s) => { s.secops.site.legacy = false; s.secops.site.sq = true; })],
  ESC003: [fix("token_post", "Tokens by POST only", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/tokens/update allowHttpGet=false allowHttpPostQueryParams=false`,
    (s) => { s.secops.site.tokenGet = false; s.secops.site.tokenPostQuery = false; })],
  ESC004: [
    fix("sdir_off", "Turn off the services directory", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/system/handlers/rest/servicesdirectory/edit enabled=false`,
      (s) => { s.secops.site.sdir = false; }, (f) => has(f, /directory/)),
    fix("origins", "Limit allowed origins to your apps", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/system/handlers/rest/servicesdirectory/edit allowedOrigins=https://apps.example.com`,
      (s) => { s.secops.site.origins = "https://apps.example.com"; }, (f) => has(f, /Cross-domain/)),
  ],
  ESC005: [
    fix("no_direct", "Admin through the Web Adaptor only", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/config/update allowDirectAccess=false`,
      (s) => { s.secops.site.direct = false; }, (f) => has(f, /directly/)),
    fix("vdirs", "Require sign-in for output directories", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/config/update virtualDirsSecurityEnabled=true`,
      (s) => { s.secops.site.vdirs = true; }, (f) => has(f, /directories/)),
  ],
  ESC006: [fix("psa_off", "Disable the primary site administrator", 0, (f, s) => `POST https://${s.arcgis.host}/server/admin/security/psa/disable`,
    (s) => { s.secops.site.psaDisabled = true; })],
};

// ------------------------------------------------------------------ attacks

// Weights per kind from what is left open. A hardened site still sees a few.
export function weights(s) {
  const x = s.secops;
  const d = x.db, w = x.site, inst = s.instance;
  return {
    exposure: inst.public && d.openRule ? 6 : d.snapshots.some((n) => n.public) ? 4 : 0.4,
    credentials: 0.5 + (d.md5Roles.length ? 3 : 0) + (x.db.secretRotation ? 0 : 1),
    destruction: 0.5 + (inst.deletionProtection ? 0 : 1),
    exfiltration: d.snapshots.some((n) => n.public || n.accounts.length) ? 3 : 0.4,
    "aws-keys": 0.5,
    certificate: 0, // comes on its own when the certificate runs out
    token: w.tokenGet || w.tokenPostQuery ? 3 : 0.4,
    "admin-account": 0.4 + (w.psaDisabled ? 0 : 2) + (w.protocol === "HTTPS" ? 0 : 1),
    "exposed-service": w.sdir && w.origins === "*" ? 2 : 0.4,
    content: 0.5,
    host: 0.3,
  };
}

function pick(ws, rand) {
  const total = Object.values(ws).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [k, v] of Object.entries(ws)) {
    if ((r -= v) <= 0) return k;
  }
  return "content";
}

function backupAge(s) {
  const b = s.arcgis && s.arcgis.webgisdr && s.arcgis.webgisdr.backups;
  return b && b.length ? s.tick - b[b.length - 1].tick : null;
}

// The real playbook's input, from game state.
export function incidentRequest(s, kind, federal, isoAt) {
  const inst = s.instance;
  const x = s.secops;
  const age = backupAge(s);
  if (RDSOPS_KINDS.includes(kind)) {
    const fed = federal;
    return {
      tool: "rdsops",
      context: {
        kind,
        instance: fed ? CLIENT.instance : inst.identifier,
        region: fed ? CLIENT.region : "us-east-1",
        federal: fed,
        role: kind === "credentials" ? "gis_editor" : null,
        access_key: kind === "aws-keys" ? "AKIAEXAMPLEOPS0LEAK1" : null,
        now: isoAt(s.tick),
        managed_secret: fed ? true : inst.managedSecret,
        deletion_protection: fed ? true : inst.deletionProtection,
        publicly_accessible: fed ? false : inst.public,
        backup_retention_days: fed ? 7 : inst.backupRetention,
        earliest_restorable: isoAt(s.tick - (fed ? 7 : inst.backupRetention) * DAY),
        since: isoAt(s.tick - (kind === "destruction" ? 2 : 6)),
        snapshot: kind === "exposure" || kind === "exfiltration" ? (x.db.snapshots[0] || {}).id || null : null,
        group: kind === "exposure" ? "sg-0egdblab" : null,
        cidr: kind === "exposure" ? "0.0.0.0/0" : null,
        arcgis: true,
      },
    };
  }
  const site = federal ? CLIENT.site : `https://${s.arcgis.host}`;
  return {
    tool: "egisops",
    context: {
      kind,
      server: `${site}/server`,
      portal: `${site}/portal`,
      federal,
      user: kind === "admin-account" ? "gisadmin2" : kind === "content" ? "editor_temp" : null,
      service: kind === "exposed-service" ? "Utilities/WaterMains.FeatureServer" : null,
      item: kind === "exposed-service" ? "a1b2c3d4e5f60718293a4b5c6d7e8f90" : null,
      machine: kind === "host" ? "GISSRV02" : null,
      since: isoAt(s.tick - 6),
      now: isoAt(s.tick),
      backup_age_hours: age,
      rpo_hours: 24,
      psa_enabled: federal ? null : !x.site.psaDisabled,
    },
  };
}

// ------------------------------------------------------------------ the incident

const lower = (st) => `${st.title} ${st.command}`.toLowerCase();
export const destroys = (st) => st.phase !== "Preserve" && DESTROYS.test(`${st.title} ${st.command}`);
const isCisa = (st) => st.phase === "Notify" && /CISA/.test(st.title);

export function openIncident(s, kind, federal, playbook, log) {
  const x = ensureSecops(s);
  const tool = RDSOPS_KINDS.includes(kind) ? "rdsops" : "egisops";
  const inc = {
    id: x.history.length + 1,
    kind, tool, federal,
    target: federal ? `${CLIENT.name} (GovCloud)` : tool === "rdsops" ? s.instance.identifier : s.arcgis.host,
    opened: s.tick,
    minute: 0,
    impact: 0,
    steps: playbook.steps.map((st, i) => ({ ...st, n: i, minutes: MINUTES[st.phase] || 10, done: false, at: null, twist: false })),
    order: [],
    findings: playbook.findings || [],
    penalties: [],
    notes: [],
    fired: [],
    evidenceLost: false,
    cisaAt: null,
    cisaLate: false,
    closed: false,
    // What the twists can see. A federal incident is at the client, whose site the takeover
    // left hardened: managed secret, deletion protection, 7 days, no md5, PSA off.
    world: federal
      ? { backupAge: 6, psaEnabled: false, deletionProtection: true, retention: 7, md5Roles: [] }
      : { backupAge: backupAge(s), psaEnabled: !x.site.psaDisabled, deletionProtection: s.instance.deletionProtection, retention: s.instance.backupRetention, md5Roles: [...x.db.md5Roles] },
  };
  x.incident = inc;
  log({ kind: "incident", text: `INCIDENT ${inc.id}: ${TITLES[kind]} on ${inc.target}.${federal ? " Federal client: the CISA clock is running." : ""}` });
  return inc;
}

export const TITLES = {
  credentials: "A database password is in the wrong hands",
  "aws-keys": "AWS access keys leaked",
  exposure: "The database was reachable from the internet",
  destruction: "Someone is deleting geodatabase data",
  exfiltration: "A snapshot may have left the account",
  certificate: "TLS failures: the database certificate ran out",
  "admin-account": "An ArcGIS administrator account is compromised",
  token: "ArcGIS tokens leaked",
  "exposed-service": "A feature service was open to anyone",
  content: "Portal content is being deleted",
  host: "An ArcGIS Server machine is compromised",
};

export function contained(inc) {
  const contain = inc.steps.filter((st) => st.phase === "Contain");
  if (contain.length) return contain.every((st) => st.done);
  return inc.steps.some((st) => st.phase === "Recover" && st.done);
}

function penalize(inc, id, text, log) {
  if (inc.penalties.some((p) => p.id === id)) return;
  inc.penalties.push({ id, text, minute: inc.minute });
  log({ kind: "warn", text: `Incident ${inc.id}: ${text}` });
}

function addStep(inc, st) {
  const step = { ...st, n: inc.steps.length, minutes: st.minutes || MINUTES[st.phase] || 10, done: false, at: null, twist: true };
  inc.steps.push(step);
  return step;
}

function advance(inc, minutes, log) {
  if (!contained(inc)) inc.impact += minutes * RATE[inc.kind];
  inc.minute += minutes;
  if (inc.federal && inc.cisaAt == null && inc.minute > CISA_MINUTES && !inc.cisaLate) {
    inc.cisaLate = true;
    penalize(inc, "cisa", `CISA report not filed within one hour (now minute ${inc.minute}).`, log);
  }
}

// Contingencies. Each fires at most once, when its condition holds after a step.
export const TWISTS = [
  {
    id: "session_alive", kinds: ["credentials"],
    when: (inc) => done(inc, /rotate the master/i) && !done(inc, /end its sessions|pg_terminate/i),
    text: "The master credential is rotated, but the attacker's session is still open. Rotation does not end sessions.",
    impact: 150,
    step: { phase: "Contain", title: "End the attacker's open sessions", command: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'gis_editor';", why: "A password change only stops new logins." },
  },
  {
    id: "shared_password", kinds: ["credentials"],
    when: (inc) => done(inc, /new password/i) && inc.world.md5Roles.length > 0,
    text: (inc) => `The same password was used by ${inc.world.md5Roles.join(" and ")}, still stored as md5.`,
    step: { phase: "Eradicate", title: "Reset the roles that shared it, with SCRAM", command: "SET password_encryption = 'scram-sha-256'; \\password sde; \\password gis_editor", why: "md5 hashes are only as strong as the password; SCRAM resists replay." },
  },
  {
    id: "second_rule", kinds: ["exposure"],
    when: (inc) => (done(inc, /rotate credentials|guard rail/i)) && !done(inc, /anything else that is open/i),
    text: "A second rule in another security group still allows 0.0.0.0/0 on 5432. The same change added both.",
    impact: 200,
    step: { phase: "Contain", title: "Remove the second open rule", command: "aws ec2 revoke-security-group-ingress --group-id sg-0legacyadmin --protocol tcp --port 5432 --cidr 0.0.0.0/0", why: "Search every group attached to the instance, not just the one you know." },
  },
  {
    id: "instance_deleted", kinds: ["destruction"],
    when: (inc) => !inc.world.deletionProtection && inc.minute >= 30 && !done(inc, /deletion protection/i),
    text: "The attacker deleted the instance too, without keeping its automated backups. The newest manual snapshot is what is left.",
    impact: 1500,
    step: { phase: "Recover", title: "Restore from the newest manual snapshot", command: "aws rds restore-db-instance-from-db-snapshot --db-instance-identifier egdb-lab-restored --db-snapshot-identifier egdb-lab-before-upgrade --no-publicly-accessible --deletion-protection", why: "Without deletion protection, one API call took the instance. Everything after the snapshot is gone." },
  },
  {
    id: "window_short", kinds: ["destruction"],
    when: (inc) => done(inc, /restore to a new instance/i) && inc.world.retention < 2,
    text: "The restore window is one day. The damage started before it.",
    impact: 400,
    step: { phase: "Recover", title: "Fall back to the last manual snapshot and replay what you can", command: "aws rds describe-db-snapshots --db-instance-identifier egdb-lab --snapshot-type manual", why: "Point-in-time recovery only reaches back as far as the backup retention period." },
  },
  {
    id: "unknown_share", kinds: ["exfiltration"],
    when: (inc) => done(inc, /snapshot the instance/i),
    text: "The snapshot attributes show a share with account 444455556666. Nobody here owns it.",
    step: { phase: "Contain", title: "Remove the share with 444455556666", command: "aws rds modify-db-snapshot-attribute --db-snapshot-identifier egdb-lab-before-upgrade --attribute-name restore --values-to-remove 444455556666", why: "A shared snapshot can be copied into the other account at any time." },
  },
  {
    id: "ca_break", kinds: ["certificate"],
    when: (inc) => done(inc, /rotate to a current ca/i) && !doneBefore(inc, /trust bundle/i, /rotate to a current ca/i),
    text: "ArcGIS Server: certificate verify failed. Every database-backed service is down.",
    impact: 600,
    step: { phase: "Recover", title: "Install the new CA bundle on every ArcGIS Server machine and restart", command: "Import the RDS CA bundle into each machine's trust store, then restart the ArcGIS Server service", why: "Clients must trust the new CA before the server presents it." },
  },
  {
    id: "other_region", kinds: ["aws-keys"],
    when: (inc) => done(inc, /everything the key did/i),
    text: "CloudTrail in another Region shows the key launched an instance: gis-miner-01 in us-west-2.",
    impact: 250,
    step: { phase: "Eradicate", title: "Terminate what the key created in us-west-2", command: "aws ec2 terminate-instances --region us-west-2 --instance-ids i-0miner0example", why: "Leaked keys work in every Region they are allowed. Check them all." },
  },
  {
    id: "psa_return", kinds: ["admin-account"],
    when: (inc) => inc.world.psaEnabled && someDone(inc, "Recover") && !done(inc, /primary site administrator/i),
    text: "The attacker signs back in as the primary site administrator. It is not in the identity store, so disabling the account did nothing to it.",
    impact: 500,
    step: { phase: "Contain", title: "Disable the primary site administrator now", command: "POST https://<server>/arcgis/admin/security/psa/disable", why: "Esri recommends disabling it once another administrator works (serverScan SS11)." },
  },
  {
    id: "scripts_fail", kinds: ["token", "admin-account"],
    when: (inc) => done(inc, /shared key|invalidate tokens/i),
    text: "Help desk: everyone was signed out, and three scheduled scripts fail with 498 Invalid token.",
    step: { phase: "Recover", title: "Issue new tokens to the scheduled scripts from a vault", command: "Store the credentials in a vault; the scripts request short-lived tokens at run time", why: "Expected after a key change. Tokens kept in scripts are how the last one leaked." },
  },
  {
    id: "anon_edits", kinds: ["exposed-service"],
    when: (inc) => done(inc, /measure what was reached/i),
    text: "Edit tracking shows 214 water main features changed by anonymous users.",
    impact: 200,
    step: { phase: "Eradicate", title: "Restore the 214 features from the geodatabase", command: "Compare with the last backup or the versioned history; restore the changed rows", why: "Anonymous update was on. Read-only sharing would have prevented it." },
  },
  {
    id: "old_backup", kinds: ["content"],
    when: (inc, s) => done(inc, /restore the smallest|whole site/i) && (inc.world.backupAge == null || inc.world.backupAge > 24),
    text: "The newest WebGISDR backup is older than the 24-hour recovery point. The difference has to be re-created by hand.",
    impact: 400,
    step: { phase: "Recover", title: "Re-create the items lost since the backup, from the incident export", command: "Compare the incident export with the restored site; republish what is missing", why: "Schedule nightly WebGISDR exports so the next restore loses less." },
  },
  {
    id: "kms_pending", kinds: ["host"],
    when: (inc) => done(inc, /capture/i),
    text: "The volume snapshot fails: the attacker scheduled the KMS key for deletion.",
    step: { phase: "Preserve", title: "Cancel the key deletion, then capture again", command: "aws kms cancel-key-deletion --key-id <key id>", why: "KMS waits 7 to 30 days before deleting a key. That window is your chance." },
  },
  {
    id: "came_back", kinds: "*",
    when: (inc) => someDone(inc, "Recover") && !contained(inc),
    text: "The attacker used the same way back in. Recovery started before containment was finished.",
    impact: 300,
    step: null,
  },
];

const done = (inc, re) => inc.steps.some((st) => st.done && re.test(`${st.title} ${st.command}`));
const someDone = (inc, phase) => inc.steps.some((st) => st.done && st.phase === phase);
function doneBefore(inc, a, b) {
  const ia = inc.order.findIndex((n) => a.test(lower(inc.steps[n])) || a.test(inc.steps[n].title));
  const ib = inc.order.findIndex((n) => b.test(inc.steps[n].title));
  return ia !== -1 && (ib === -1 || ia < ib);
}

function fireTwists(inc, s, log) {
  for (const t of TWISTS) {
    if (inc.fired.includes(t.id)) continue;
    if (t.kinds !== "*" && !t.kinds.includes(inc.kind)) continue;
    if (!t.when(inc, s)) continue;
    inc.fired.push(t.id);
    const text = typeof t.text === "function" ? t.text(inc) : t.text;
    inc.impact += t.impact || 0;
    log({ kind: "incident", text: `Incident ${inc.id}: ${text}` });
    inc.notes.push(text);
    if (t.step) addStep(inc, t.step);
    if (t.id === "came_back") penalize(inc, "came_back", "Recovered before containment: the attacker came back.", log);
  }
}

// One player choice. Returns { ok, reason } and logs what happened.
export function takeStep(s, n, log) {
  const inc = s.secops && s.secops.incident;
  if (!inc || inc.closed) return { ok: false, reason: "No open incident." };
  const st = inc.steps[n];
  if (!st || st.done) return { ok: false, reason: "That step is done." };
  if (st.phase === "Learn" && inc.steps.some((x) => !x.done && x.phase !== "Learn")) {
    return { ok: false, reason: "The review comes last. Finish the response first." };
  }
  if (st.phase !== "Triage" && inc.steps.some((x) => x.phase === "Triage" && !x.done)) {
    penalize(inc, "triage", "Acted before triage: no lead, no timeline, no scope.", log);
  }
  // Lost evidence: a step that destroys it, ahead of evidence the playbook keeps first.
  if (destroys(st)) {
    const missing = inc.steps.filter((x) => x.phase === "Preserve" && !x.done && !x.twist && x.n < st.n);
    if (missing.length) {
      inc.evidenceLost = true;
      penalize(inc, `evidence:${st.n}`, `Evidence lost: "${st.title}" ran before "${missing[0].title}".`, log);
    }
  }
  advance(inc, st.minutes, log);
  st.done = true;
  st.at = inc.minute;
  inc.order.push(n);
  if (isCisa(st)) {
    inc.cisaAt = inc.minute;
    if (inc.minute > CISA_MINUTES) penalize(inc, "cisa", `CISA report filed at minute ${inc.minute}, after the one-hour deadline.`, log);
  }
  log({ kind: "action", text: `[incident ${inc.id}, minute ${inc.minute}] ${st.title}${st.command ? `: ${st.command}` : ""}` });
  fireTwists(inc, s, log);
  return { ok: true };
}

// The world keeps going while an incident is open: an hour per tick.
export function incidentTick(s, log) {
  const inc = s.secops && s.secops.incident;
  if (!inc || inc.closed) return;
  advance(inc, 60, log);
  fireTwists(inc, s, log);
}

export function score(inc) {
  const base = 250 + 20 * inc.steps.length;
  const xp = Math.max(50, base - 60 * inc.penalties.length);
  return { xp, cost: Math.round(inc.impact) };
}

export function readyToClose(inc) {
  return Boolean(inc) && !inc.closed && inc.steps.every((st) => st.done);
}

export function closeIncident(s, log) {
  const x = s.secops;
  const inc = x.incident;
  if (!readyToClose(inc)) return null;
  inc.closed = true;
  const r = score(inc);
  s.budget -= r.cost;
  const c = s.counters;
  c.incidentsClosed = (c.incidentsClosed || 0) + 1;
  if (!inc.evidenceLost) c.evidenceKept = (c.evidenceKept || 0) + 1;
  if (!inc.penalties.length) c.cleanIncidents = (c.cleanIncidents || 0) + 1;
  if (inc.federal && inc.cisaAt != null && inc.cisaAt <= CISA_MINUTES) c.cisaOnTime = (c.cisaOnTime || 0) + 1;
  if (inc.impact < 500) c.lowImpact = (c.lowImpact || 0) + 1;
  if (inc.fired.length >= 2) c.twistsSurvived = (c.twistsSurvived || 0) + 1;
  if (inc.fired.includes("came_back")) c.cameBack = (c.cameBack || 0) + 1;
  x.history.push({ id: inc.id, kind: inc.kind, federal: inc.federal, minutes: inc.minute, impact: Math.round(inc.impact), penalties: inc.penalties.map((p) => p.text), twists: inc.fired, xp: r.xp });
  if (x.history.length > 30) x.history.splice(0, x.history.length - 30);
  x.incident = null;
  x.nextAt = s.tick + 36;
  log({ kind: "done", text: `Incident ${inc.id} closed after ${inc.minute} minutes. Impact $${r.cost.toLocaleString()}. ${inc.penalties.length ? `${inc.penalties.length} problem(s) in the response.` : "Clean response."}` });
  return r;
}

// Attacks arrive on their own. `playbookFor(request)` is the real tool through the bridge.
export function secopsTick(s, rand, log, playbookFor) {
  const x = s.secops;
  if (!x || x.started == null) return [];
  if (x.incident) {
    incidentTick(s, log);
    return [];
  }
  if (!playbookFor) return [];
  let kind = null;
  if (x.db.certTill != null && s.tick >= x.db.certTill) {
    kind = "certificate";
    x.db.certTill = s.tick + 365 * DAY; // renewed during the incident
  } else if (x.nextAt != null && s.tick >= x.nextAt) {
    const ws = weights(s);
    const first = x.history.length === 0;
    const rate = first ? 1 : Math.min(0.04, 0.0015 * Object.values(ws).reduce((a, b) => a + b, 0));
    if (rand() < rate) kind = first ? (s.instance.public && x.db.openRule ? "exposure" : "credentials") : pick(ws, rand);
  }
  if (!kind) return [];
  const federal = Boolean(s.takeover && s.takeover.started != null) && kind !== "certificate" && x.history.length > 0 && rand() < 0.35;
  return [{ open: kind, federal }];
}
