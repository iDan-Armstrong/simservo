import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/js/game.js";
import * as DR from "../site/js/dr.js";
import { monthlyCost, snapshot } from "../site/js/engine.js";

// Stand-ins for the real rdsops (tests/test_bridge.py runs the real ones).
const rules = {
  evaluate: (snap) => {
    const r = snap.resilience;
    if (!r) return [];
    const regionPaths = [
      ...r.backup_replications.map((b) => ({ scenario: "region", name: `Replicated automated backups (${b.region})`, rpo_minutes: 10, rto_minutes: r.measured_region_minutes ?? r.measured_restore_minutes ?? null })),
      ...r.replicas.map((x) => ({ scenario: "region", name: `Cross-Region read replica ${x.identifier} (${x.region})`, rpo_minutes: 0.5, rto_minutes: r.measured_region_minutes ?? null })),
    ];
    return regionPaths.length
      ? [{ code: "RES002", severity: "OK", title: "Region loss", detail: "", evidence: { scenario: "region", paths: regionPaths }, source: "resilience" }]
      : [{ code: "RES002", severity: "FAIL", title: "No recovery path for Region loss", detail: "", evidence: { scenario: "region" }, source: "resilience" }];
  },
  failoverPlan: ({ request, resilience }) => request.kind === "az" && !resilience.facts.multi_az
    ? { findings: [{ code: "DRD000", severity: "FAIL", title: "Single-AZ" }], steps: [] }
    : { findings: [{ code: "DRD000", severity: request.kind === "az" ? "WARN" : "OK", title: "plan" }], steps: ["a", "b", "c", "d"] },
  failoverEvaluate: ({ request, result }) => {
    const mins = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
    const rto = mins(result.started, result.apps_ok_at);
    const gap = mins(result.writable_at, result.apps_ok_at);
    return [
      { code: "DRD001", severity: rto <= request.rto_minutes ? "OK" : "FAIL", title: "rto", evidence: { kind: request.kind, rto_minutes: Math.round(rto * 10) / 10 } },
      { code: "DRD003", severity: gap > 5 ? "WARN" : "OK", title: "reconnect" },
    ];
  },
};

function at16(seed = 101) {
  const g = new Game({ seed, rules });
  g.s.xp = 16000; g.progress();
  g.scan({ manual: false });
  return g;
}
const finish = (g) => { for (let i = 0; i < 6 && g.s.pending; i++) g.tick(); };

test("DR opens at level 16 and the real tool's input is built from game state", () => {
  const g = at16();
  assert.ok(g.s.level >= DR.UNLOCK_LEVEL);
  assert.notEqual(g.s.dr.started, null);
  const r = snapshot(g.s).resilience;
  assert.equal(r.dr_region, "us-west-2");
  assert.deepEqual(r.backup_replications, []);
  assert.equal(r.dr_kms_key, g.s.instance.encrypted ? false : null);
  assert.ok(g.findings.some((f) => f.source === "resilience"));
});

test("backup replication needs the DR key first, and costs a little each month", () => {
  const g = at16(102);
  g.s.instance.backupRetention = 7;
  const [key, rep] = [DR.DR_ACTIONS.RES002[0], DR.DR_ACTIONS.RES002[1]];
  assert.equal(rep.available(g.s), false);
  key.apply(g.s);
  assert.equal(rep.available(g.s), true);
  const before = monthlyCost(g.s);
  rep.apply(g.s);
  assert.ok(monthlyCost(g.s) > before);
  assert.equal(snapshot(g.s).resilience.backup_replications[0].status, "replicating");
  assert.match(rep.command({}, g.s), /start-db-instance-automated-backups-replication --region us-west-2/);
});

test("a zone drill needs Multi-AZ; the default JVM DNS cache shows up in the score", () => {
  const g = at16(103);
  g.s.instance.multiAz = false;
  assert.equal(g.runFailoverDrill("az").ok, false);
  g.s.instance.multiAz = true;
  assert.ok(g.runFailoverDrill("az").ok);
  finish(g);
  assert.equal(g.s.counters.azDrills, 1);
  const last = g.s.dr.lastDrill.findings;
  assert.equal(last.find((f) => f.code === "DRD003").severity, "WARN");
  assert.ok(g.s.dr.measured.az > 10);
  assert.ok(g.fixDnsTtl().ok);
  assert.ok(g.runFailoverDrill("az").ok);
  finish(g);
  assert.equal(g.s.dr.lastDrill.findings.find((f) => f.code === "DRD003").severity, "OK");
  assert.ok(g.s.dr.measured.az < 5);
});

test("a Region drill measures the time the real tool then uses", () => {
  const g = at16(104);
  g.s.instance.backupRetention = 7;
  DR.DR_ACTIONS.RES005[0].apply(g.s);
  DR.DR_ACTIONS.RES002[1].apply(g.s);
  assert.ok(g.runFailoverDrill("region").ok);
  finish(g);
  assert.ok(g.s.dr.measured.region > 0);
  assert.equal(snapshot(g.s).resilience.measured_region_minutes, g.s.dr.measured.region);
});

test("losing the Region: a drilled path is faster than an undrilled one", () => {
  const undrilled = at16(105);
  undrilled.s.instance.backupRetention = 7;
  DR.DR_ACTIONS.RES005[0].apply(undrilled.s);
  DR.DR_ACTIONS.RES002[1].apply(undrilled.s);
  undrilled.s.instance.status = "region-lost";
  undrilled.s.instance.downUntil = undrilled.s.tick + 18;
  undrilled.scan({ manual: false });
  const a = undrilled.failOverRegion(0);
  assert.ok(a.ok && !a.drilled && a.hours >= DR.UNDRILLED_PENALTY_HOURS);
  assert.equal(undrilled.s.dr.activeRegion, "us-west-2");

  const drilled = at16(106);
  drilled.s.instance.backupRetention = 7;
  DR.DR_ACTIONS.RES005[0].apply(drilled.s);
  DR.DR_ACTIONS.RES002[1].apply(drilled.s);
  drilled.runFailoverDrill("region"); finish(drilled);
  drilled.s.instance.status = "region-lost";
  drilled.s.instance.downUntil = drilled.s.tick + 18;
  drilled.scan({ manual: false });
  const b = drilled.failOverRegion(0);
  assert.ok(b.ok && b.drilled && b.hours < a.hours);
  assert.equal(drilled.s.counters.drilledFailovers, 1);
});

test("promoting the replica uses it up; nothing to fail over to without a copy", () => {
  const g = at16(107);
  g.s.instance.backupRetention = 7;
  DR.DR_ACTIONS.RES005[0].apply(g.s);
  DR.DR_ACTIONS.RES002[2].apply(g.s);
  g.s.instance.status = "region-lost"; g.s.instance.downUntil = g.s.tick + 18;
  g.scan({ manual: false });
  const i = DR.regionPaths(g.findings).findIndex((p) => p.name.startsWith("Cross-Region read replica"));
  assert.ok(g.failOverRegion(i).ok);
  assert.equal(g.s.dr.replica, null);

  const none = at16(108);
  none.s.instance.status = "region-lost"; none.s.instance.downUntil = none.s.tick + 18;
  none.scan({ manual: false });
  assert.equal(none.failOverRegion(0).ok, false);
});

test("a broken replica and stopped replication show up in what the real tool reads", () => {
  const g = at16(109);
  g.s.instance.backupRetention = 7;
  DR.DR_ACTIONS.RES005[0].apply(g.s);
  DR.DR_ACTIONS.RES002[1].apply(g.s);
  g.s.instance.backupRetention = 0;
  DR.drTick(g.s, () => 0.5, () => {});
  assert.equal(snapshot(g.s).resilience.backup_replications[0].status, "stopped");
});
