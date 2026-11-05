import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/js/game.js";
import { RELEASE_DELAY, STEPS, takeoverSnapshot } from "../site/js/takeover.js";

// Stand-in for the real aurora-plan and compat, enough to drive chapters. The parity test
// runs the real ones on the same snapshots.
function fake(snap) {
  const t = snap.takeover;
  if (!t) return [];
  const mk = (code, severity, source = "aurora-plan") => ({ code, severity, title: "", detail: "", evidence: {}, source });
  if (t.compat) return [mk("CMP001", "OK", "client-compat")];
  const f = t.plan.facts;
  const free = f.free_bytes / (f.allocated_gb * 1024 ** 3);
  return [
    mk("AUR001", f.aurora_versions.includes("17.6") ? "OK" : "FAIL"),
    mk("AUR002", f.aurora_replica_clusters.length ? "FAIL" : "OK"),
    mk("AUR003", f.encrypted ? "OK" : "FAIL"),
    mk("AUR005", free < 0.2 ? "WARN" : "OK"),
  ];
}

const run = (g, h) => { for (let i = 0; i < h; i++) g.tick(); };

function unlocked(seed) {
  const g = new Game({ seed, evaluate: fake });
  g.s.xp = 9000;
  g.progress();
  assert.equal(g.s.level, 14);
  return g;
}

test("the takeover waits for the 12.1 Upgrade, then opens", () => {
  const g = unlocked(51);
  assert.equal(g.s.takeover.started, null); // expansion 1 not done
  g.s.campaign.finished = true;
  g.scan({ manual: false });
  assert.notEqual(g.s.takeover.started, null);
  assert.ok(g.events.some((e) => e.kind === "takeover" && e.chapter === 1));
});

test("GovCloud snapshot carries the facts aurora-plan reads", () => {
  const g = unlocked(52);
  g.s.campaign.finished = true;
  g.scan({ manual: false });
  const p = takeoverSnapshot(g.s).plan;
  assert.equal(p.facts.region, "us-gov-west-1");
  assert.equal(p.facts.encrypted, false);
  assert.deepEqual(p.facts.aurora_replica_clusters, ["nwsa-aurora-try1"]);
  assert.ok(!p.facts.aurora_versions.includes("17.6"));
  assert.ok(STEPS.create_cluster.command.includes("arn:aws-us-gov:rds:us-gov-west-1:"));
});

test("the whole takeover, with real-tool gating", () => {
  const g = unlocked(53);
  g.s.campaign.finished = true;
  g.scan({ manual: false });
  const t = g.s.takeover;
  for (const id of ["delete_try", "grow_storage", "kms_key"]) { assert.ok(g.takeoverAct(id).ok, id); run(g, 1); }
  assert.equal(t.chapter, 1, "17.6 is not in GovCloud yet");
  run(g, RELEASE_DELAY);
  assert.ok(t.client.regionAurora.includes("17.6"));
  assert.equal(t.chapter, 2);
  // out of order is refused
  assert.match(g.takeoverAct("promote").reason, /current chapter/);
  assert.ok(g.takeoverAct("create_cluster").ok);
  run(g, 2 + 6);
  assert.equal(t.chapter, 3);
  assert.ok(t.client.cluster.walGb > 0);
  assert.match(g.takeoverAct("promote").reason, /Stop writes first/);
  assert.ok(g.takeoverAct("stop_writes").ok);
  assert.match(g.takeoverAct("start_writes").reason, /Point the data stores/);
  assert.ok(g.takeoverAct("promote").ok); run(g, 1);
  assert.ok(g.takeoverAct("repoint").ok); run(g, 1);
  assert.ok(g.takeoverAct("start_writes").ok);
  assert.ok(t.clientDownHours <= 3);
  assert.equal(takeoverSnapshot(g.s).compat.platform, "aurora");
  const budget = g.s.budget;
  assert.ok(g.takeoverAct("add_reader").ok); run(g, 1);
  assert.ok(t.finished);
  assert.ok(g.s.budget > budget + 1000);
  assert.ok(g.s.achievements.includes("the_takeover") && g.s.achievements.includes("clean_cutover"));
});
