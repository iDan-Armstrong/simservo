import { test } from "node:test";
import assert from "node:assert/strict";
import { GIB, clock, freeBytes, newGame, rng, snapshot, step } from "../site/js/engine.js";
import { Game, incidentKey } from "../site/js/game.js";
import { SCENARIOS } from "../site/js/scenarios.js";

const stub = () => [];

test("same seed, same story", () => {
  const run = () => {
    const g = new Game({ seed: 99, evaluate: stub });
    g.s.level = 9; // scenarios on
    for (let i = 0; i < 300; i++) g.tick();
    return JSON.stringify([g.s.budget, g.s.scenarios.history, g.s.db.xidAge, g.s.db.sessions.length]);
  };
  assert.equal(run(), run());
});

test("business hours bring connections; nights are quiet", () => {
  const s = newGame(1);
  const r = rng(1);
  let day = 0, night = 0;
  for (let i = 0; i < 48; i++) {
    step(s, r);
    const { hour } = clock(s.tick);
    if (hour === 16) day = s.db.sessions.length;
    if (hour === 8) night = s.db.sessions.length;
  }
  assert.ok(day > night * 2, `day ${day} night ${night}`);
});

test("an open transaction stops autovacuum from cleaning", () => {
  const s = newGame(2);
  const r = rng(2);
  s.db.sessions.push({ pid: 1, user: "x", application: "ArcGIS Pro", state: "idle in transaction", since: 0, query: "" });
  for (let i = 0; i < 72; i++) step(s, r);
  const lineages = s.db.tables.find((t) => t.table === "sde_state_lineages");
  assert.ok(lineages.dead > 2000, `dead ${lineages.dead}`);
});

test("an orphaned slot fills the disk", () => {
  const s = newGame(3);
  const r = rng(3);
  SCENARIOS.find((x) => x.id === "orphan_slot").start(s);
  let hours = 0;
  while (s.instance.status === "available" && hours < 500) { step(s, r); hours++; }
  assert.equal(s.instance.status, "storage-full");
  assert.ok(freeBytes(s) <= 0);
});

test("every scenario starts and snapshots cleanly", () => {
  for (const sc of SCENARIOS) {
    const s = newGame(4);
    sc.start(s, () => {});
    step(s, rng(4));
    const snap = snapshot(s);
    assert.ok(snap.instance && snap.storage && snap.compat, sc.id);
  }
});

test("snapshot uses the rdsops field names", () => {
  const s = newGame(5);
  step(s, rng(5));
  const snap = snapshot(s);
  for (const k of ["server_version", "max_connections", "client_connections", "oldest_xid_age", "slots", "stat_statements"]) assert.ok(k in snap.health, k);
  for (const k of ["identifier", "publicly_accessible", "backup_retention_days", "parameter_groups"]) assert.ok(k in snap.instance, k);
  assert.equal(snap.storage.allocated_gb, 20);
  assert.ok(snap.storage.free_bytes < 20 * GIB);
});

test("resolving an incident awards XP once", () => {
  let findings = [{ code: "INV002", severity: "FAIL", title: "Instance is publicly accessible", detail: "", evidence: {}, source: "inventory" }];
  const g = new Game({ seed: 6, evaluate: () => findings });
  assert.ok(g.s.incidents[incidentKey(findings[0])]);
  findings = [];
  g.scan({ manual: false });
  const xp = g.s.xp;
  assert.ok(xp >= 40);
  g.scan({ manual: false });
  assert.equal(g.s.xp, xp);
});

test("Trollzilla takes the region down for a day", () => {
  const g = new Game({ seed: 8, evaluate: stub, forceTrollzilla: true });
  g.tick();
  assert.equal(g.s.instance.status, "region-lost");
  for (let i = 0; i < 24; i++) g.tick();
  assert.equal(g.s.instance.status, "available");
});
