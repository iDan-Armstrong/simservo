// The simulated ArcGIS Server site. Like the database, the game only keeps the facts;
// the real egisops server-health evaluator decides what is wrong with them.

const START = Date.UTC(2026, 0, 5, 6, 0, 0); // must match engine.js
const DAY = 24;
const isoTick = (tick) => new Date(START + tick * 3600_000).toISOString().replace("Z", "+00:00");

export function newSite() {
  return {
    version: "11.5.0",
    licensed: true,
    host: "gis.example.com",
    machines: [{ name: "GISSERVER1.EXAMPLE.COM", configured: "STARTED", realtime: "STARTED" }],
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
  return s.arcgis;
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
