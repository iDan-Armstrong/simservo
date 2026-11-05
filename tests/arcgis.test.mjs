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
