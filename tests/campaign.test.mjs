import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/js/game.js";
import { ACTIONS } from "../site/js/actions.js";
import { stackSnapshot, STEPS } from "../site/js/campaign.js";

// A stand-in for the real stack-compat: FAIL when releases are mixed or the database is
// unsupported, INFO when Pro is not the companion. The parity test runs the real one.
function fakeStack(snap) {
  const st = snap.stack;
  if (!st) return [];
  const rel = new Set(st.components.map((c) => c.version.split(".").slice(0, 2).join(".")));
  const out = [{ code: "STK001", severity: rel.size > 1 ? "FAIL" : "OK", title: "", detail: "", evidence: {}, source: "stack-compat" }];
  if (rel.has("11.5") && rel.size === 1) out.push({ code: "CMP001", severity: "FAIL", title: "", detail: "", evidence: {}, source: "stack-compat" });
  if (st.pro_version !== "3.7") out.push({ code: "STK004", severity: "INFO", title: "", detail: "", evidence: {}, source: "stack-compat" });
  return out;
}

function level12(seed) {
  const g = new Game({ seed, evaluate: fakeStack });
  g.s.xp = 6500;
  g.progress();
  assert.equal(g.s.level, 12);
  return g;
}

const run = (g, hours) => { for (let i = 0; i < hours; i++) g.tick(); };

test("the expansion starts at level 12 and stack-compat replaces compat", () => {
  const g = level12(41);
  assert.ok(g.s.campaign.started != null);
  g.scan({ manual: false });
  assert.deepEqual([...new Set(g.findings.map((f) => f.code))], ["STK001", "CMP001", "STK004"]);
  assert.equal(stackSnapshot(g.s).target, "12.1");
});

test("Esri's order is enforced, with the reason", () => {
  const g = level12(42);
  let r = g.campaignAct("upgrade_portal");
  assert.equal(r.ok, false);
  assert.match(r.reason, /Finish the current chapter/);
  g.s.campaign.chapter = 2;
  r = g.campaignAct("upgrade_portal");
  assert.match(r.reason, /take a backup of ArcGIS Enterprise before upgrading/);
  r = g.campaignAct("upgrade_server");
  assert.match(r.reason, /upgrade Portal for ArcGIS before the hosting server/);
  assert.ok(g.s.counters.outOfOrder >= 1);
});

test("the whole campaign, start to finale", () => {
  const g = level12(43);
  const events = () => g.events.splice(0).filter((e) => e.kind === "campaign");
  // chapter 1: retire three batches of Web AppBuilder apps, take a backup
  for (let i = 0; i < 3; i++) { assert.ok(g.campaignAct("migrate_wab").ok); run(g, 4); }
  assert.equal(g.s.arcgis.portal.wabApps, 0);
  ACTIONS.BAK010[0].apply(g.s);
  run(g, 1);
  assert.deepEqual(events().map((e) => e.chapter), [2]);
  // chapter 2: portal goes down for its upgrade, and its fixes wait
  assert.ok(g.campaignAct("upgrade_portal").ok);
  assert.ok(g.s.arcgis.portal.machines.every((m) => !m.ready));
  const blocked = g.act({ code: "PTL001", evidence: {} }, "restart_portal");
  assert.equal(blocked.ok, false);
  run(g, 4);
  assert.equal(g.s.arcgis.portal.version, "12.1.0");
  assert.equal(g.findings.find((f) => f.code === "STK001").severity, "FAIL"); // mixed releases
  assert.ok(g.campaignAct("upgrade_server").ok);
  assert.ok(g.s.arcgis.machines.every((m) => m.realtime === "STOPPED"));
  run(g, 3);
  assert.ok(g.campaignAct("upgrade_datastore").ok);
  run(g, 3);
  assert.deepEqual(events().map((e) => e.chapter), [3]);
  assert.equal(g.findings.find((f) => f.code === "STK001").severity, "OK");
  // chapter 3: Pro, then a clean scan ends it
  assert.ok(g.campaignAct("rollout_pro").ok);
  run(g, 6);
  assert.ok(g.s.campaign.finished);
  assert.ok(events().some((e) => e.finale));
  assert.ok(g.s.achievements.includes("twelve_one"));
  assert.equal(stackSnapshot(g.s).target, null);
});

test("every campaign step names the real procedure", () => {
  for (const [id, step] of Object.entries(STEPS)) {
    assert.ok(step.command.length > 30, id);
    assert.ok(!step.command.includes("—") && !step.label.includes("—"), id);
  }
});
