// Scenario deck. Each scenario only changes the simulated system; rdsops decides what
// is wrong with it. `teaches` lists the real rdsops finding codes the scenario is
// expected to raise, and the test suite checks those codes exist in rdsops.
//
// weight: relative chance per roll. minLevel: first level it can appear.

import { GIB, MIB, addSession } from "./engine.js";

export const SCENARIOS = [
  {
    id: "connection_storm",
    title: "Connection storm",
    category: "attack",
    blurb: "A public map went viral, or someone is hammering the feature service. ArcGIS Server spins up service instances and every one wants a connection.",
    teaches: ["HLT001"],
    minLevel: 3, weight: 6, duration: 8,
    start(s) { s.db.extraConnections += 70; },
    end(s) { s.db.extraConnections = Math.max(0, s.db.extraConnections - 70); },
  },
  {
    id: "runaway_query",
    title: "Runaway report",
    category: "accident",
    blurb: "An analyst's ad hoc report is joining every parcel to every gravity main without a spatial filter. It is still running.",
    teaches: ["HLT002", "HLT004"],
    minLevel: 3, weight: 6,
    start(s) {
      addSession(s, { user: "analyst", application: "psql", state: "active", since: s.tick - 1, blocks: true,
        query: "SELECT p.apn, m.facilityid FROM parcels.parcels p, sewer.gravity_mains m WHERE ST_DWithin(p.shape, m.shape, 0.01)" });
      addSession(s, { user: "gis_editor", application: "ArcGIS Pro", state: "active", since: s.tick, waiting: true,
        query: "ALTER TABLE parcels.parcels ADD COLUMN zoning text" });
    },
  },
  {
    id: "idle_editor",
    title: "Editor left for lunch mid-transaction",
    category: "accident",
    blurb: "An ArcGIS Pro edit session opened a transaction and walked away. Vacuum cannot clean anything newer than that transaction.",
    teaches: ["HLT003", "MNT001"],
    minLevel: 3, weight: 7,
    start(s) {
      addSession(s, { user: "gis_editor", application: "ArcGIS Pro", state: "idle in transaction", since: s.tick - 1,
        query: "UPDATE sewer.manholes SET rimelev = 14.2 WHERE objectid = 1042" });
    },
  },
  {
    id: "orphan_slot",
    title: "The migration nobody turned off",
    category: "accident",
    blurb: "A database migration task was deleted months ago, but its logical replication slot was not. The slot is holding every byte of WAL since then.",
    teaches: ["HLT006", "HLT010"],
    minLevel: 4, weight: 4,
    start(s) { s.db.slots.push({ name: "dms_parcels_2025", active: false, retained: 1.2 * GIB, growth: 220 * MIB }); },
  },
  {
    id: "public_flip",
    title: "Someone opened the front door",
    category: "bad-actor",
    blurb: "A contractor flipped the instance to publicly accessible to 'test from home'. Your database now answers the internet.",
    teaches: ["INV002"],
    minLevel: 4, weight: 4,
    when: (s) => !s.instance.public,
    start(s) { s.instance.public = true; },
  },
  {
    id: "bulk_load",
    title: "Bulk load, no index",
    category: "accident",
    blurb: "250,000 sewer laterals were loaded overnight with a script that skipped the spatial index and the analyze.",
    teaches: ["MNT006", "MNT002"],
    minLevel: 3, weight: 5,
    when: (s) => !s.db.tables.some((t) => t.table === "laterals"),
    start(s) {
      s.db.tables.push({ schema: "sewer", table: "laterals", live: 250_000, dead: 0, mod: 250_000, editsPerHour: 10, bytesPerRow: 380,
        lastVacuum: s.tick, lastAnalyze: null, neverAnalyzed: true, autovacuum: false, spatial: "shape", hasGist: false });
    },
  },
  {
    id: "duplicate_index",
    title: "Belt, suspenders and a second belt",
    category: "accident",
    blurb: "Two people fixed the same slow query on the same day. Both created an index on facilityid.",
    teaches: ["MNT004"],
    minLevel: 4, weight: 3,
    when: (s) => !s.db.duplicateIndexes.length,
    start(s) {
      const a = { schema: "sewer", table: "manholes", index: "manholes_facilityid_idx", bytes: 9 * MIB, definition: "CREATE INDEX manholes_facilityid_idx ON sewer.manholes USING btree (facilityid)" };
      s.db.duplicateIndexes.push([a, { ...a, index: "idx_mh_facid", definition: "CREATE INDEX idx_mh_facid ON sewer.manholes USING btree (facilityid)" }]);
    },
  },
  {
    id: "failed_concurrent",
    title: "The index that never finished",
    category: "accident",
    blurb: "CREATE UNIQUE INDEX CONCURRENTLY hit a duplicate value and failed, leaving an invalid index that every write still maintains.",
    teaches: ["MNT005"],
    minLevel: 5, weight: 3,
    when: (s) => !s.db.invalidIndexes.length,
    start(s) {
      s.db.invalidIndexes.push({ schema: "parcels", table: "parcels", index: "parcels_apn_uq", bytes: 14 * MIB, definition: "CREATE UNIQUE INDEX parcels_apn_uq ON parcels.parcels USING btree (apn)" });
    },
  },
  {
    id: "auto_minor_postgis",
    title: "Patch Tuesday surprise",
    category: "force-majeure",
    blurb: "The maintenance window applied a new minor version automatically. It came with a newer PostGIS.",
    teaches: ["CMP003", "INV008"],
    minLevel: 7, weight: 3,
    when: (s) => s.instance.postgis === "3.5.2",
    start(s, log) {
      if (s.instance.autoMinor) {
        s.instance.engineVersion = "17.8";
        s.instance.postgis = "3.5.3";
      } else {
        log({ kind: "good", text: "AWS released 17.8 with PostGIS 3.5.3. Auto minor upgrade is off, so nothing changed. Your runbook would have caught issue 5978." });
        s.counters.heldUpgrade = (s.counters.heldUpgrade || 0) + 1;
      }
    },
  },
  {
    id: "az_outage",
    title: "Availability Zone outage",
    category: "force-majeure",
    blurb: "Power and cooling trouble in one Availability Zone. Everything in it is down.",
    teaches: ["INV006"],
    minLevel: 5, weight: 2,
    start(s, log) {
      if (s.instance.multiAz) {
        log({ kind: "good", text: "Multi-AZ failover: the standby took over in about a minute. Nobody noticed." });
        s.counters.failovers = (s.counters.failovers || 0) + 1;
      } else {
        s.instance.status = "az-outage";
        s.instance.downUntil = s.tick + 6;
        log({ kind: "outage", text: "Single-AZ instance is down with its zone. Expect about 6 hours, or restore elsewhere." });
      }
    },
  },
  {
    id: "xid_creep",
    title: "The table autovacuum forgot",
    category: "accident",
    blurb: "Someone turned off autovacuum on a busy table 'for the bulk load' and never turned it back on. Transaction ID age is climbing.",
    teaches: ["HLT005"],
    minLevel: 8, weight: 2,
    start(s) { s.db.xidAge = Math.max(s.db.xidAge, 620_000_000); },
  },
  {
    id: "soc_crash",
    title: "Patch night took a machine down",
    category: "accident",
    blurb: "Windows updates rebooted the GIS server overnight and the ArcGIS Server service did not come back. Map services on that machine are dark.",
    teaches: ["SRV003", "SRV001"],
    minLevel: 4, weight: 4,
    when: (s) => s.arcgis && s.arcgis.machines.some((m) => m.realtime === "STARTED"),
    start(s) { const m = s.arcgis.machines.find((x) => x.realtime === "STARTED"); m.realtime = "STOPPED"; },
  },
  {
    id: "cert_rollback",
    title: "Who put the old certificate back?",
    category: "accident",
    blurb: "A web adaptor reinstall quietly bound the default self-signed certificate. ArcGIS Pro users get trust warnings and the federation handshake fails.",
    teaches: ["SRV006"],
    minLevel: 4, weight: 2,
    when: (s) => s.arcgis && s.arcgis.cert.trusted,
    start(s) { Object.assign(s.arcgis.cert, { trusted: false, issuer: "CN=gis.example.com", subject: "CN=gis.example.com" }); },
  },
  {
    id: "license_reminder_missed",
    title: "The renewal email went to a former employee",
    category: "accident",
    blurb: "Esri sent the license renewal notice to someone who left last spring. A license is about to run out.",
    teaches: ["SRV004"],
    minLevel: 4, weight: 2,
    when: (s) => s.arcgis && s.arcgis.licenses.every((l) => l.expiresTick - s.tick > 30 * 24),
    start(s) { s.arcgis.licenses[0].expiresTick = s.tick + 12 * 24; },
  },
  {
    id: "dropped_table",
    title: "DROP TABLE on the wrong window",
    category: "accident",
    blurb: "Someone ran a cleanup script in the production window instead of test. sewer.manholes is gone, and every map with manholes on it is broken.",
    teaches: ["DRL001", "DRL002"],
    via: "drill-plan",
    minLevel: 6, weight: 3,
    when: (s) => s.db.tables.some((t) => t.table === "manholes"),
    start(s) {
      const i = s.db.tables.findIndex((t) => t.table === "manholes");
      const [t] = s.db.tables.splice(i, 1);
      s.db.lost = s.db.lost || [];
      s.db.lost.push({ table: t, tick: s.tick });
    },
  },
  {
    id: "audit",
    title: "The auditor wants proof",
    category: "compliance",
    blurb: "An auditor asks for evidence that backups can actually be restored, within your 60-minute recovery target. You have 48 hours.",
    teaches: ["DRL011"],
    via: "drill-evaluate",
    minLevel: 6, weight: 2,
    when: (s) => !s.auditDue,
    start(s) { s.auditDue = s.tick + 48; },
  },
  {
    id: "trollzilla",
    title: "TROLLZILLA",
    category: "monster",
    blurb: "A wobbling signal wave rises out of the backbone, dripping binary. It is eating us-east-1.",
    teaches: [],
    minLevel: 10, weight: 0.5, // about once every 40 game days
    start(s, log) {
      s.instance.status = "region-lost";
      s.instance.downUntil = s.tick + 24;
      s.counters.trollzilla = (s.counters.trollzilla || 0) + 1;
      log({ kind: "monster", text: "TROLLZILLA is eating the region. Without a copy elsewhere, you wait it out." });
    },
  },
];

export function eligible(s, level) {
  const active = new Set(s.scenarios.active.map((a) => a.id));
  return SCENARIOS.filter((x) => level >= x.minLevel && !active.has(x.id) && (!x.when || x.when(s)));
}

// Roughly one new scenario every 10 to 14 game hours once they unlock.
export function roll(s, level, rand, chancePerHour = 0.09) {
  if (rand() > chancePerHour) return null;
  const pool = eligible(s, level).filter((x) => x.weight > 0);
  const total = pool.reduce((a, x) => a + x.weight, 0);
  let r = rand() * total;
  for (const x of pool) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return null;
}

export function byId(id) {
  return SCENARIOS.find((x) => x.id === id);
}
