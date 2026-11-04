import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, rng, step } from "../site/js/engine.js";
import { backupFacts, backupTick, drillRequest, simulateDrill } from "../site/js/drills.js";
import { Game } from "../site/js/game.js";
import { SCENARIOS } from "../site/js/scenarios.js";

// Stub rules: a plan fails only when there are no backups; evaluate passes.
const rules = (overrides = {}) => ({
  evaluate: () => [],
  drillPlan: (p) => ({ findings: p.facts.retention_days ? [{ code: "DRL001", severity: "OK", title: "ok" }]
    : [{ code: "DRL001", severity: "FAIL", title: "Automated backups are off" }], steps: [] }),
  drillEvaluate: () => [{ code: "DRL011", severity: "OK", title: "fast" }],
  ...overrides,
});

test("daily snapshots follow the retention window", () => {
  const s = newGame(1);
  s.instance.backupRetention = 7;
  const r = rng(1);
  for (let i = 0; i < 24 * 10; i++) { step(s, r); backupTick(s); }
  const auto = s.db.snapshots.filter((x) => x.kind === "automated");
  assert.ok(auto.length >= 7 && auto.length <= 8, `kept ${auto.length}`);
  s.instance.backupRetention = 0;
  backupTick(s);
  assert.equal(backupFacts(s).snapshots.length, 0);
  assert.equal(backupFacts(s).latest_restorable, null);
});

test("simulated drill timeline is ordered and verifies the spatial tables", () => {
  const s = newGame(2);
  const req = drillRequest(s, { level: 6 });
  const { payload, hours } = simulateDrill(s, req, rng(2));
  const r = payload.result;
  const t = (x) => Date.parse(x);
  assert.ok(t(r.started) < t(r.restore_requested) && t(r.restore_requested) < t(r.available) && t(r.available) < t(r.verified) && t(r.verified) < t(r.deleted));
  assert.ok(hours >= 1);
  assert.deepEqual(req.verify_tables, ["sewer.manholes", "sewer.gravity_mains"]);
  assert.ok(r.checks.every((c) => c.ok));
});

test("a passing drill awards XP, completes the quest and answers an audit", () => {
  const g = new Game({ seed: 3, rules: rules() });
  g.s.level = 6; g.s.xp = 1700; g.s.auditDue = g.s.tick + 48;
  const res = g.runDrill("pitr");
  assert.ok(res.ok);
  for (let i = 0; i < 4; i++) g.tick();
  assert.equal(g.s.counters.cleanDrills, 1);
  assert.equal(g.s.counters.auditPassed, 1);
  assert.equal(g.s.auditDue, null);
  assert.ok(g.s.quests.includes("q_drill"));
});

test("drills are locked before level 6 and blocked without backups", () => {
  const g = new Game({ seed: 4, rules: rules() });
  assert.equal(g.runDrill().ok, false);
  g.s.level = 6;
  g.s.instance.backupRetention = 0;
  const r = g.runDrill();
  assert.equal(r.ok, false);
  assert.match(r.reason, /backups/i);
});

test("a dropped table comes back only if backups were on", () => {
  for (const retention of [7, 0]) {
    const g = new Game({ seed: 5, rules: rules() });
    g.s.level = 6;
    g.s.instance.backupRetention = retention;
    SCENARIOS.find((x) => x.id === "dropped_table").start(g.s);
    assert.equal(g.s.db.lost.length, 1);
    const r = g.recoverTable("sewer.manholes");
    for (let i = 0; i < 5; i++) g.tick();
    const back = g.s.db.tables.some((t) => t.table === "manholes");
    assert.equal(back, retention > 0, `retention ${retention}`);
    assert.equal(r.ok, retention > 0);
    assert.equal(g.s.db.lost.length, 0);
  }
});

test("a missed audit costs money", () => {
  const g = new Game({ seed: 6, rules: rules() });
  g.s.auditDue = g.s.tick + 2;
  const before = g.s.budget;
  for (let i = 0; i < 3; i++) g.tick();
  assert.equal(g.s.auditDue, null);
  assert.ok(g.s.budget < before - 100);
});
