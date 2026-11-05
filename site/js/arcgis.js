// The simulated ArcGIS Enterprise base deployment: ArcGIS Server, Portal for ArcGIS and
// ArcGIS Data Store. Like the database, the game only keeps the facts; the real egisops
// evaluators (server-health, services, logs, portal-health, datastore) decide what is
// wrong with them.

const START = Date.UTC(2026, 0, 5, 6, 0, 0); // must match engine.js
const DAY = 24;
const isoTick = (tick) => new Date(START + tick * 3600_000).toISOString().replace("Z", "+00:00");

export function newSite() {
  return {
    version: "11.5.0",
    licensed: true,
    host: "gis.example.com",
    machines: [{ name: "GISSERVER1.EXAMPLE.COM", configured: "STARTED", realtime: "STARTED" }],
    portal: newPortal(),
    datastore: newDataStore(),
    licenses: [
      { name: "ArcGIS Server Standard", canExpire: true, expiresTick: 400 * DAY },
      { name: "Data Interoperability", canExpire: true, expiresTick: 45 * DAY },
    ],
    // Fresh installs ship a self-signed certificate. Replacing it is an early lesson.
    cert: { subject: "CN=gis.example.com", issuer: "CN=gis.example.com", notAfterTick: 3650 * DAY, trusted: false },
    services: newServices(),
    logs: [],
  };
}

// demand: share of the business-hours load this service sees, relative to its pool.
function newServices() {
  const svc = (folder, name, type, max, demand) =>
    ({ folder, name, type, configured: "STARTED", realtime: "STARTED", max, busy: 0, demand, spike: 0 });
  return [
    svc("Maps", "Stormwater", "MapServer", 2, 1.1),
    svc("Maps", "Sewer", "FeatureServer", 2, 0.9),
    svc("Maps", "Parcels", "MapServer", 3, 0.8),
    svc("System", "PublishingTools", "GPServer", 2, 0.1),
  ];
}

export const fullName = (x) => `${x.folder}/${x.name}.${x.type}`;

// Log codes and messages in the simulation are illustrative, not Esri's catalog.
function logEntry(s, type, code, source, machine, message) {
  s.arcgis.logs.push({ type, code, source, machine, message, tick: s.tick });
}

export function ensureSite(s) {
  if (!s.arcgis) s.arcgis = newSite();
  if (!s.arcgis.portal) s.arcgis.portal = newPortal(); // saves from before v0.3
  if (!s.arcgis.datastore) s.arcgis.datastore = newDataStore();
  return s.arcgis;
}

// ------------------------------------------------------------ Portal for ArcGIS

const SERVER_ID = "hS8wQf2kP0aLz9Xc";
const SERVER_ADMIN = "https://gis.example.com:6443/arcgis";

export function newPortal() {
  const ut = (id, maximum, current) => ({ id, maximum, current, expiresTick: 365 * DAY });
  return {
    version: "11.5.0",
    licensed: true,
    machines: [{ name: "PORTAL1.EXAMPLE.COM", role: "primary", ready: true }],
    userTypes: [ut("creatorUT", 25, 14), ut("fieldWorkerUT", 40, 31), ut("viewerUT", 100, 52)],
    federated: true,
    groups: 38,
    items: 1240,
    indexLag: 0, // items stored but not yet in the search index
  };
}

// ----------------------------------------------------------- ArcGIS Data Store

export function newDataStore() {
  return {
    name: "ds_k3v9q1zt",
    release: "11.5.0",
    machines: [{ name: "DATASTORE1.EXAMPLE.COM", role: "PRIMARY", up: true }],
    registered: true,
    serverConnection: true,
    backupEveryHours: 96, // the game's schedule, not a recommendation
    lastBackupTick: -20,
    backupLocationFull: false,
  };
}

export const dsPath = (d) => `/enterpriseDatabases/AGSDataStore_${d.name}`;
export const dsPrimaryUp = (s) => {
  const d = ensureSite(s).datastore;
  return d.machines.some((m) => m.role === "PRIMARY" && m.up);
};

// Same field names as egisops.portal.PortalSnapshot. The portal sits behind the same web
// adaptor host as ArcGIS Server, so its certificate is the one server-health already
// checks; it is left out here so one certificate is not scored twice.
export function portalSnapshot(s) {
  const a = ensureSite(s);
  const p = a.portal;
  const d = a.datastore;
  const up = p.machines.some((m) => m.ready);
  const members = p.userTypes.reduce((n, u) => n + u.current, 0);
  const seats = p.userTypes.reduce((n, u) => n + u.maximum, 0);
  // The success messages are Esri's documented ones; the failure messages are illustrative.
  let validation = { status: "success", messages: [
    `ArcGIS Server administration URL '${SERVER_ADMIN}' is accessible.`,
    "Validating hosting server.",
    `ArcGIS Server '${SERVER_ADMIN}' version matches with Portal for ArcGIS.`,
    `Verified that server has an ArcGIS Data Store registered as a managed database '${dsPath(d)}'.`,
    `The server managed database '${dsPath(d)}' validated successfully.`,
  ] };
  if (!siteUp(s)) {
    validation = { status: "failure", messages: [`ArcGIS Server administration URL '${SERVER_ADMIN}' is not accessible.`] };
  } else if (!dsPrimaryUp(s)) {
    validation = { status: "failure", messages: [
      `ArcGIS Server administration URL '${SERVER_ADMIN}' is accessible.`,
      "Validating hosting server.",
      `The server managed database '${dsPath(d)}' is not accessible.`,
    ] };
  }
  return {
    base_url: `https://${a.host}/portal`,
    health_status: up ? 200 : 503,
    health_ok: up,
    version: p.version,
    licensed: p.licensed,
    site_error: null,
    machines: p.machines.map((m) => ({ name: m.name, role: m.role, ready: m.ready, reason: m.ready ? "" : "Machine is not available." })),
    entitlements: p.userTypes.map((u) => ({ kind: "userType", id: u.id, expires: isoTick(u.expiresTick), current: u.current, maximum: u.maximum })),
    members: [members, seats],
    certificate: null,
    servers: p.federated ? [{ id: SERVER_ID, name: "gis.example.com:6443", admin_url: SERVER_ADMIN, role: "HOSTING_SERVER", function: "" }] : [],
    validation_status: p.federated ? validation.status : null,
    validations: p.federated && up ? [{ server_id: SERVER_ID, status: validation.status, messages: validation.messages, admin_url: SERVER_ADMIN }] : [],
    indexes: up ? [
      { name: "users", database: members, index: members },
      { name: "groups", database: p.groups, index: p.groups },
      { name: "search", database: p.items, index: p.items - p.indexLag },
    ] : [],
    index_sync: up ? p.indexLag === 0 : null,
    errors: [],
  };
}

// Same field names as egisops.datastore.DataStoreSnapshot. "Unhealthy" stands in for
// whatever a failing data store reports; Esri's examples only show "Healthy".
export function datastoreSnapshot(s) {
  const a = ensureSite(s);
  const d = a.datastore;
  return {
    base_url: `https://${a.host}/server`,
    stores: [{
      path: dsPath(d),
      kind: "relational",
      name: d.name,
      overall: dsPrimaryUp(s) ? "Healthy" : "Unhealthy",
      registered: d.registered,
      server_connection: d.serverConnection,
      machines: d.machines.map((m) => ({
        name: m.name, role: m.role, reachable: true,
        status: m.up ? "Started" : "Stopped", health: m.up ? "Healthy" : "Unhealthy", accepting: m.up,
      })),
      unavailable: [],
      last_backup: d.lastBackupTick == null ? null : isoTick(d.lastBackupTick),
      backup_reported: true,
      release: d.release,
      cluster_status: null,
      unassigned_shards: null,
    }],
    errors: [],
  };
}

// Scheduled backups, and hosted layers failing while the data store is down.
export function enterpriseTick(s) {
  const a = ensureSite(s);
  const d = a.datastore;
  if (!d.backupLocationFull && dsPrimaryUp(s) && s.tick - d.lastBackupTick >= d.backupEveryHours) d.lastBackupTick = s.tick;
  if (!dsPrimaryUp(s) && siteUp(s)) {
    logEntry(s, "SEVERE", 8559, "Hosted/Inspections.FeatureServer", a.machines[0].name, "Failed to connect to the managed database.");
  }
}

export function addPortalMachine(s) {
  const p = ensureSite(s).portal;
  if (p.machines.length < 2) p.machines.push({ name: "PORTAL2.EXAMPLE.COM", role: "standby", ready: true });
}

export function addDataStoreStandby(s) {
  const d = ensureSite(s).datastore;
  if (d.machines.length < 2) d.machines.push({ name: "DATASTORE2.EXAMPLE.COM", role: "STANDBY", up: true });
}

// The machine the data store loses. With a healthy standby, the standby takes over as
// primary, as ArcGIS Data Store does in a primary-standby pair.
export function stopDataStorePrimary(s) {
  const d = ensureSite(s).datastore;
  const primary = d.machines.find((m) => m.role === "PRIMARY");
  const standby = d.machines.find((m) => m.role === "STANDBY" && m.up);
  primary.up = false;
  if (standby) { standby.role = "PRIMARY"; primary.role = "STANDBY"; }
}

export function siteUp(s) {
  return !s.arcgis || s.arcgis.machines.some((m) => m.realtime === "STARTED");
}

// Same field names as egisops.server.ServerSnapshot.
export function serverSnapshot(s) {
  const a = ensureSite(s);
  const up = siteUp(s);
  return {
    base_url: `https://${a.host}/arcgis`,
    health_status: up ? 200 : 503,
    health_success: up,
    full_version: a.version,
    licensed: a.licensed,
    machines: a.machines.map((m) => ({ name: m.name, configured: m.configured, realtime: m.realtime })),
    licenses: a.licenses.map((l) => ({ name: l.name, can_expire: l.canExpire, expires: isoTick(l.expiresTick) })),
    certificate: {
      host: a.host, subject: a.cert.subject, issuer: a.cert.issuer,
      not_after: isoTick(a.cert.notAfterTick), trusted: a.cert.trusted,
    },
    errors: [],
  };
}

// Same field names as egisops.services.ServicesSnapshot.
export function servicesSnapshot(s) {
  const a = ensureSite(s);
  const svcs = a.services || [];
  return {
    folders: ["", ...new Set(svcs.map((x) => x.folder))],
    services: svcs.map((x) => ({
      folder: x.folder, name: x.name, type: x.type, configured: x.configured,
      realtime: siteUp(s) ? x.realtime : "STOPPED", max: x.max, busy: x.busy, free: Math.max(0, x.max - x.busy),
    })),
    errors: [],
  };
}

// Same field names as egisops.logs.LogSnapshot: the last 24 hours, SEVERE only.
export function logsSnapshot(s) {
  const a = ensureSite(s);
  return {
    hours: 24,
    level: "SEVERE",
    entries: (a.logs || []).filter((e) => s.tick - e.tick < 24 && e.type === "SEVERE").map((e) => ({
      type: e.type, code: e.code, source: e.source, machine: e.machine, message: e.message, time: isoTick(e.tick),
    })),
    truncated: false,
    errors: [],
  };
}

// Expired licenses stop the server, as they do in real life.
export function siteTick(s, log, load = 0.5, rand = Math.random) {
  const a = ensureSite(s);
  a.services = a.services || newServices();
  a.logs = a.logs || [];
  const machineUp = a.machines.find((m) => m.realtime === "STARTED");
  for (const x of a.services) {
    const running = x.realtime === "STARTED" && machineUp;
    if (!running) {
      x.busy = 0;
      if (x.configured === "STARTED") {
        logEntry(s, "SEVERE", 8252, fullName(x), a.machines[0].name, "Failed to create the service.");
      }
      continue;
    }
    const want = x.max * x.demand * load * (0.6 + rand() * 0.6) + (x.spike > 0 ? x.max * 2 : 0);
    x.busy = Math.min(x.max, Math.round(want));
    if (want > x.max) {
      logEntry(s, "SEVERE", 9019, fullName(x), machineUp.name,
        "Wait time of the request to the service has exceeded the configured timeout.");
    }
    if (x.spike > 0) x.spike -= 1;
  }
  a.logs = a.logs.filter((e) => s.tick - e.tick < 24 * 3);
  const expired = a.licenses.find((l) => l.canExpire && l.name.startsWith("ArcGIS Server") && l.expiresTick <= s.tick);
  if (expired && a.licensed) {
    a.licensed = false;
    for (const m of a.machines) m.realtime = "STOPPED";
    log({ kind: "outage", text: `${expired.name} license expired. ArcGIS Server stopped serving.` });
  }
}

export function addMachine(s) {
  const a = ensureSite(s);
  if (a.machines.length < 2) a.machines.push({ name: "GISSERVER2.EXAMPLE.COM", configured: "STARTED", realtime: "STARTED" });
}
