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
  };
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

// Expired licenses stop the server, as they do in real life.
export function siteTick(s, log) {
  const a = ensureSite(s);
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
