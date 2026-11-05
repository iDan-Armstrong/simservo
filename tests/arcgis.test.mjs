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
