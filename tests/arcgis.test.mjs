import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, rng, snapshot, step } from "../site/js/engine.js";
import { serverSnapshot, siteTick } from "../site/js/arcgis.js";
import { Game } from "../site/js/game.js";

test("server snapshot uses the egisops field names", () => {
  const snap = serverSnapshot(newGame(1));
  for (const k of ["base_url", "health_status", "health_success", "full_version", "licensed", "machines", "licenses", "certificate"]) assert.ok(k in snap, k);
  assert.equal(snap.certificate.trusted, false);
  assert.ok(snapshot(newGame(1)).now);
});

test("an expired server license stops the site and counts as downtime", () => {
  const s = newGame(2);
  s.arcgis.licenses[0].expiresTick = 2;
  const r = rng(2);
  const logs = [];
  for (let i = 0; i < 4; i++) { step(s, r); siteTick(s, (e) => logs.push(e)); }
  assert.equal(s.arcgis.licensed, false);
  assert.ok(s.arcgis.machines.every((m) => m.realtime === "STOPPED"));
  assert.ok(logs.some((l) => /license expired/.test(l.text)));
  step(s, r);
  assert.ok(s.uptime.down >= 1);
});

test("reaching level 41 adds a second machine", () => {
  const g = new Game({ seed: 3, evaluate: () => [] });
  assert.equal(g.s.arcgis.machines.length, 1);
  g.s.xp = 200_000;
  g.progress();
  assert.equal(g.s.arcgis.machines.length, 2);
});

test("server-health is gated to level 4", () => {
  const seen = [];
  const g = new Game({ seed: 4, evaluate: (snap) => { seen.push(snap.server); return [{ code: "SRV006", severity: "WARN", title: "self-signed", detail: "", evidence: {}, source: "server-health" }]; } });
  assert.ok(seen[0]);
  assert.equal(g.findings.length, 0); // filtered below level 4
  g.s.level = 4;
  g.scan({ manual: false });
  assert.equal(g.findings[0].code, "SRV006");
});

import { logsSnapshot, servicesSnapshot } from "../site/js/arcgis.js";
import { SCENARIOS } from "../site/js/scenarios.js";
import { ACTIONS } from "../site/js/actions.js";

test("a crashed service logs SEVERE every hour until it is started", () => {
  const s = newGame(5);
  SCENARIOS.find((x) => x.id === "service_crash").start(s);
  for (let i = 0; i < 3; i++) { s.tick += 1; siteTick(s, () => {}, 0.5, rng(5)); }
  const entries = logsSnapshot(s).entries.filter((e) => e.source === "Maps/Sewer.FeatureServer");
  assert.equal(entries.length, 3);
  const finding = { code: "SVC001", title: "x", evidence: { service: "Maps/Sewer.FeatureServer" } };
  ACTIONS.SVC001[0].apply(s, finding);
  s.tick += 1; siteTick(s, () => {}, 0.5, rng(5));
  assert.equal(logsSnapshot(s).entries.filter((e) => e.source === "Maps/Sewer.FeatureServer").length, 3);
  assert.ok(servicesSnapshot(s).services.every((x) => x.realtime === "STARTED"));
});

test("storm day pins the Stormwater pool and raising max instances relieves it", () => {
  const s = newGame(6);
  SCENARIOS.find((x) => x.id === "storm_day").start(s);
  siteTick(s, () => {}, 1, rng(6));
  const storm = () => servicesSnapshot(s).services.find((x) => x.name === "Stormwater");
  assert.equal(storm().busy, storm().max);
  ACTIONS.SVC003[0].apply(s, { evidence: { service: "Maps/Stormwater.MapServer", max: 2 } });
  assert.equal(storm().max, 4);
});

test("logs older than 24 hours leave the window", () => {
  const s = newGame(7);
  SCENARIOS.find((x) => x.id === "service_crash").start(s);
  siteTick(s, () => {}, 0.5, rng(7));
  ACTIONS.SVC001[0].apply(s, { evidence: { service: "Maps/Sewer.FeatureServer" } });
  s.tick += 25;
  assert.equal(logsSnapshot(s).entries.length, 0);
});

import { datastoreSnapshot, portalSnapshot, enterpriseTick } from "../site/js/arcgis.js";

test("portal and data store snapshots use the egisops field names", () => {
  const s = newGame(21);
  const p = portalSnapshot(s);
  for (const k of ["base_url", "health_status", "health_ok", "version", "licensed", "machines", "entitlements", "members", "servers", "validation_status", "validations", "indexes", "index_sync", "errors"]) assert.ok(k in p, k);
  assert.equal(p.validations[0].status, "success");
  const d = datastoreSnapshot(s).stores[0];
  for (const k of ["path", "kind", "name", "overall", "registered", "server_connection", "machines", "unavailable", "last_backup", "backup_reported", "release", "cluster_status", "unassigned_shards"]) assert.ok(k in d, k);
  assert.ok(d.path.startsWith("/enterpriseDatabases/AGSDataStore_"));
});

test("a stopped data store fails federation validation and logs hosted layer errors", () => {
  const s = newGame(22);
  SCENARIOS.find((x) => x.id === "datastore_down").start(s);
  assert.equal(portalSnapshot(s).validations[0].status, "failure");
  assert.equal(datastoreSnapshot(s).stores[0].overall, "Unhealthy");
  enterpriseTick(s);
  assert.ok(s.arcgis.logs.some((e) => e.source === "Hosted/Inspections.FeatureServer"));
  ACTIONS.DST002[0].apply(s);
  assert.equal(portalSnapshot(s).validations[0].status, "success");
});

test("with a standby, the data store fails over and federation stays green", () => {
  const s = newGame(23);
  ACTIONS.DST003[0].apply(s);
  SCENARIOS.find((x) => x.id === "datastore_down").start(s);
  const d = datastoreSnapshot(s).stores[0];
  assert.equal(d.overall, "Healthy");
  assert.deepEqual(d.machines.map((m) => [m.name, m.role, m.status]), [["DATASTORE1.EXAMPLE.COM", "STANDBY", "Stopped"], ["DATASTORE2.EXAMPLE.COM", "PRIMARY", "Started"]]);
  assert.equal(portalSnapshot(s).validations[0].status, "success");
});

test("data store backups run on schedule and stop when the share is full", () => {
  const s = newGame(24);
  const d = s.arcgis.datastore;
  s.tick = d.lastBackupTick + d.backupEveryHours;
  enterpriseTick(s);
  assert.equal(d.lastBackupTick, s.tick);
  SCENARIOS.find((x) => x.id === "backup_share_full").start(s);
  const stale = d.lastBackupTick;
  s.tick += 200;
  enterpriseTick(s);
  assert.equal(d.lastBackupTick, stale);
});

test("extra portal and data store machines show on the AWS bill", async () => {
  const { monthlyCost, EXTRA_MACHINE_MONTH } = await import("../site/js/engine.js");
  const s = newGame(25);
  const before = monthlyCost(s);
  ACTIONS.PTL003[1].apply(s);
  ACTIONS.DST003[0].apply(s);
  assert.equal(Math.round(monthlyCost(s) - before), 2 * EXTRA_MACHINE_MONTH);
});

test("portal-health and datastore are gated to levels 9 and 10", () => {
  const g = new Game({ seed: 26, evaluate: () => [
    { code: "PTL003", severity: "INFO", title: "single", detail: "", evidence: {}, source: "portal-health" },
    { code: "DST003", severity: "INFO", title: "no standby", detail: "", evidence: {}, source: "datastore" },
  ] });
  g.s.level = 8; g.scan({ manual: false });
  assert.equal(g.findings.length, 0);
  g.s.level = 9; g.scan({ manual: false });
  assert.deepEqual(g.findings.map((f) => f.code), ["PTL003"]);
  g.s.level = 10; g.scan({ manual: false });
  assert.deepEqual(g.findings.map((f) => f.code), ["PTL003", "DST003"]);
});

import { backupSnapshot, exportNow, webgisdrTick } from "../site/js/arcgis.js";

test("webgisdr paths are doubled the way Esri writes them", () => {
  const b = backupSnapshot(newGame(31));
  assert.equal(b.raw.BACKUP_LOCATION, String.raw`\\\\fileserver\\wgbackups`);
  assert.equal(b.properties.BACKUP_LOCATION, String.raw`\\fileserver\wgbackups`);
  assert.deepEqual(b.backups, []);
  assert.equal(b.properties.PORTAL_ADMIN_PASSWORD_ENCRYPTED, "false");
});

test("an export writes a dated .webgissite, encrypts the password and is read back as a run", () => {
  const s = newGame(32);
  assert.ok(exportNow(s));
  const b = backupSnapshot(s);
  assert.match(b.backups[0].name, /^20260105-060000-UTC-BACKUP\.webgissite$/);
  assert.equal(b.raw.PORTAL_ADMIN_PASSWORD_ENCRYPTED, "true");
  assert.equal(b.runs[0].status, "success");
  assert.ok(b.runs[0].backup_location.endsWith(b.backups[0].name));
});

test("an export fails by component when the data store is down, and on a full share", () => {
  const s = newGame(33);
  SCENARIOS.find((x) => x.id === "datastore_down").start(s);
  assert.equal(exportNow(s), false);
  const run = backupSnapshot(s).runs[0];
  assert.deepEqual(run.components.filter((c) => c.status === "failure").map((c) => [c.name, c.store_type]), [["ArcGIS Data Store", "relational"]]);
  ACTIONS.DST002[0].apply(s);
  SCENARIOS.find((x) => x.id === "wg_share_full").start(s);
  assert.equal(backupSnapshot(s).runs.at(-1).status, "failure");
  assert.equal(backupSnapshot(s).backups.length, 0);
  ACTIONS.BAK011[0].apply(s);
  assert.equal(backupSnapshot(s).backups.length, 1);
});

test("single backslashes break exports until they are doubled again", () => {
  const s = newGame(34);
  SCENARIOS.find((x) => x.id === "wg_tidied_paths").start(s);
  assert.equal(exportNow(s), false);
  assert.match(s.arcgis.webgisdr.runs.at(-1).messages, /does not exist/);
  ACTIONS.BAK003[0].apply(s);
  assert.ok(exportNow(s));
});

test("the nightly task runs at 02:00 only when scheduled, and keeps seven backups", () => {
  const s = newGame(35);
  const logs = [];
  ACTIONS.BAK010[1].apply(s);
  for (let i = 0; i < 24 * 9; i++) { s.tick += 1; webgisdrTick(s, (e) => logs.push(e)); }
  assert.equal(s.arcgis.webgisdr.backups.length, 7);
  assert.equal(logs.length, 9);
  SCENARIOS.find((x) => x.id === "wg_schedule_lost").start(s);
  const n = s.arcgis.webgisdr.runs.length;
  for (let i = 0; i < 48; i++) { s.tick += 1; webgisdrTick(s, () => {}); }
  assert.equal(s.arcgis.webgisdr.runs.length, n);
});
