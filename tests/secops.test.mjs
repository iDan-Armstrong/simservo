import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Game } from "../site/js/game.js";
import * as SO from "../site/js/secops.js";
import { isoAt, snapshot } from "../site/js/engine.js";

// The real playbooks, exported by tools/export-playbooks.py (checked against the real
// tools in tests/test_bridge.py).
const PLAYBOOKS = JSON.parse(readFileSync(new URL("./fixtures/playbooks.json", import.meta.url)));
const incidentPlaybook = (req) => structuredClone(PLAYBOOKS[`${req.context.kind}${req.context.federal ? "-federal" : ""}`]);
const evaluate = () => [];

function atLevel15(seed = 81) {
  const g = new Game({ seed, rules: { evaluate, incidentPlaybook } });
  g.s.xp = 12000; g.progress();
  g.scan({ manual: false });
  return g;
}

function open(g, kind, federal = false) {
  return g.openIncident({ open: kind, federal });
}

const stepIndex = (inc, re) => inc.steps.findIndex((st) => !st.done && re.test(`${st.title} ${st.command}`));
const doInOrder = (g, inc) => {
  for (let guard = 0; guard < 60; guard++) {
    const next = inc.steps.find((st) => !st.done && (st.phase !== "Learn" || inc.steps.every((x) => x.done || x.phase === "Learn")));
    if (!next) break;
    assert.ok(g.incidentStep(next.n).ok, next.title);
  }
};

test("security opens at level 15 and its sources reach the findings", () => {
  const g = atLevel15();
  assert.ok(g.s.level >= SO.UNLOCK_LEVEL);
  assert.notEqual(g.s.secops.started, null);
  assert.ok(g.events.some((e) => e.kind === "secops" && e.started));
  const snap = snapshot(g.s);
  assert.equal(snap.security.rds.params["rds.force_ssl"], "0");
  assert.equal(snap.security.server.token_get, true);
});

test("the first attack comes within a day, from what is left open", () => {
  const g = atLevel15(82);
  for (let i = 0; i < 24 && !g.s.secops.incident; i++) g.tick();
  const inc = g.s.secops.incident;
  assert.ok(inc, "an incident opened");
  assert.equal(inc.kind, g.s.instance.public ? "exposure" : "credentials");
  assert.ok(inc.steps.length > 8);
  assert.ok(g.events.some((e) => e.kind === "secops" && e.incident));
});

test("every real playbook can be run to the end in its own order without penalties", () => {
  for (const key of Object.keys(PLAYBOOKS)) {
    const [kind, fed] = [key.replace("-federal", ""), key.endsWith("-federal")];
    const g = atLevel15(83);
    g.s.instance.deletionProtection = true; // keep destruction's deleted-instance twist out
    g.s.instance.backupRetention = 7;
    const inc = open(g, kind, fed);
    inc.world.deletionProtection = true;
    inc.world.retention = 7;
    doInOrder(g, inc);
    assert.ok(SO.readyToClose(inc), key);
    assert.deepEqual(inc.penalties.map((p) => p.text), [], key);
    assert.ok(!inc.fired.includes("came_back"), key);
    const r = g.closeIncident();
    assert.ok(r.ok && r.xp > 0, key);
    assert.equal(g.s.secops.incident, null);
  }
});

test("destroying evidence first is caught by the playbook's own order", () => {
  const g = atLevel15(84);
  const inc = open(g, "credentials");
  const terminate = stepIndex(inc, /end its sessions/i);
  assert.ok(terminate >= 0);
  g.incidentStep(0); g.incidentStep(1);
  g.incidentStep(terminate);
  assert.equal(inc.evidenceLost, true);
  assert.match(inc.penalties.at(-1).text, /Evidence lost/);
});

test("rotating without ending the session leaves the attacker in", () => {
  const g = atLevel15(85);
  const inc = open(g, "credentials");
  doUntil(g, inc, /rotate the master/i);
  assert.ok(inc.fired.includes("session_alive"));
  assert.ok(inc.steps.some((st) => st.twist && /open sessions/.test(st.title)));
});

function doUntil(g, inc, re) {
  g.incidentStep(0); g.incidentStep(1);
  for (const st of inc.steps) if (st.phase === "Preserve" || st.phase === "Notify") g.incidentStep(st.n);
  g.incidentStep(stepIndex(inc, re));
}

test("federal: the CISA report is due within the hour", () => {
  const late = atLevel15(86);
  const inc = open(late, "exposure", true);
  for (const st of inc.steps.filter((x) => x.phase === "Triage" || x.phase === "Contain")) late.incidentStep(st.n);
  late.incidentStep(inc.steps.find((x) => /CISA/.test(x.title)).n);
  assert.ok(inc.cisaAt > SO.CISA_MINUTES);
  assert.ok(inc.penalties.some((p) => p.id === "cisa"));

  const onTime = atLevel15(87);
  const inc2 = open(onTime, "exposure", true);
  doInOrder(onTime, inc2);
  assert.ok(inc2.cisaAt <= SO.CISA_MINUTES);
  onTime.closeIncident();
  assert.equal(onTime.s.counters.cisaOnTime, 1);
});

test("an incident left open costs money every hour and misses the CISA clock", () => {
  const g = atLevel15(88);
  const inc = open(g, "exfiltration", true);
  const before = inc.impact;
  g.tick(); g.tick();
  assert.ok(inc.impact > before);
  assert.ok(inc.cisaLate);
});

test("recovering before containment brings the attacker back", () => {
  const g = atLevel15(89);
  const inc = open(g, "certificate");
  g.incidentStep(0); g.incidentStep(1);
  g.incidentStep(stepIndex(inc, /rotate to a current ca/i));
  assert.ok(inc.fired.includes("ca_break"));
  assert.ok(inc.fired.includes("came_back"));
});

test("no deletion protection: the attacker deletes the instance too", () => {
  const g = atLevel15(90);
  g.s.instance.deletionProtection = false;
  const inc = open(g, "destruction");
  g.incidentStep(0); g.incidentStep(1); g.incidentStep(2);
  g.incidentStep(stepIndex(inc, /stop the writing/i));
  g.incidentStep(stepIndex(inc, /snapshot the instance/i));
  assert.ok(inc.fired.includes("instance_deleted"));
  assert.ok(inc.impact >= 1500);
});

test("the review comes last", () => {
  const g = atLevel15(91);
  const inc = open(g, "token");
  const learn = inc.steps.find((st) => st.phase === "Learn");
  assert.equal(g.incidentStep(learn.n).ok, false);
});

test("posture fixes change what the real tools read", () => {
  const g = atLevel15(92);
  const sec = () => snapshot(g.s).security;
  SO.SEC_ACTIONS.SEC001[0].apply(g.s);
  SO.SEC_ACTIONS.ESC003[0].apply(g.s);
  SO.SEC_ACTIONS.ESC006[0].apply(g.s);
  assert.equal(sec().rds.params["rds.force_ssl"], "1");
  assert.equal(sec().rds.non_ssl_connections, 0);
  assert.equal(sec().server.token_get, false);
  const w = SO.weights(g.s);
  assert.ok(w.token < 1 && w["admin-account"] < 2);
});

test("the certificate incident comes when the certificate runs out", () => {
  const g = atLevel15(93);
  g.s.secops.nextAt = 1e9;
  g.s.secops.db.certTill = g.s.tick + 1;
  g.tick(); g.tick();
  assert.equal(g.s.secops.incident && g.s.secops.incident.kind, "certificate");
});

test("requests use GovCloud for the federal client", () => {
  const g = atLevel15(94);
  const r = SO.incidentRequest(g.s, "credentials", true, isoAt);
  assert.equal(r.context.region, "us-gov-west-1");
  const e = SO.incidentRequest(g.s, "token", true, isoAt);
  assert.match(e.context.server, /nwsa/);
});
