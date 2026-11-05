import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/js/game.js";
import { ARRIVALS, ARRIVAL_EVERY, FIXES, fleetSnapshot } from "../site/js/fleet.js";
import { snapshot } from "../site/js/engine.js";

const fake = (snap) => (snap.fleet ? snap.fleet.members.map((m) => ({
  code: "FLT001", severity: m.facts.publicly_accessible ? "FAIL" : "OK", title: m.facts.identifier, detail: "",
  evidence: { instance: m.facts.identifier }, source: "fleet",
})) : []);

function afterTakeover(seed) {
  const g = new Game({ seed, evaluate: fake });
  g.s.xp = 9000; g.progress();
  g.s.campaign.finished = true;
  g.s.takeover.started = 0; g.s.takeover.finished = true;
  g.scan({ manual: false });
  return g;
}

test("the fleet opens after the takeover with the client's RDS test instance", () => {
  const g = afterTakeover(61);
  assert.notEqual(g.s.fleet.started, null);
  assert.deepEqual(g.s.fleet.members.map((m) => m.id), ["nwsa-egdb-test"]);
  const snap = fleetSnapshot(g.s, { facts: snapshot(g.s).instance, production: false });
  assert.deepEqual(snap.members.map((m) => m.region), ["us-east-1", "us-gov-west-1"]);
  assert.equal(snap.members[1].facts.engine, "postgres");
  assert.ok(g.events.some((e) => e.kind === "fleet" && e.started));
});

test("sites arrive on a schedule, all six, with their problems", () => {
  const g = afterTakeover(62);
  for (let i = 0; i < ARRIVAL_EVERY * 7; i++) g.tick();
  assert.equal(g.s.fleet.members.length, 1 + ARRIVALS.length);
  const parks = g.s.fleet.members.find((m) => m.id === "parks-egdb");
  assert.equal(parks.public, true);
  assert.ok(g.findings.some((f) => f.code === "FLT001" && f.severity === "FAIL"));
});

test("fixes change the facts the real tool reads, and money follows", () => {
  const g = afterTakeover(63);
  g.s.fleet.nextArrival = g.s.tick;
  g.tick();
  const parks = g.s.fleet.members.find((m) => m.id === "parks-egdb");
  assert.ok(parks);
  assert.ok(FIXES.patch.when(parks));
  assert.ok(g.fleetAct("parks-egdb", "baseline").ok);
  assert.equal(g.fleetAct("parks-egdb", "patch").ok, false); // busy
  for (let i = 0; i < 2; i++) g.tick();
  assert.equal(parks.public, false);
  assert.ok(g.fleetAct("parks-egdb", "patch").ok); g.tick();
  assert.equal(parks.engineVersion, "17.7");
  assert.ok(g.fleetAct("nwsa-egdb-test", "tag").ok);
  assert.equal(g.s.fleet.members[0].arcgis, "12.1");
  const harbor = { ...parks, encrypted: false, production: true, multiAz: false };
  assert.ok(FIXES.encrypt.when(harbor) && FIXES.multi_az.when(harbor));
  assert.ok(FIXES.tag.command(g.s.fleet.members[0]).includes("arn:aws-us-gov:rds:us-gov-west-1:"));
});
