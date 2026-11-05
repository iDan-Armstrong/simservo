// Prints, as JSON, everything the Python parity test needs: the finding codes the game
// relies on, and for each scenario a snapshot taken one game hour after it starts
// during business hours (with the instance private, so scenarios that open it show).
import { ACTIONS } from "../site/js/actions.js";
import { clock, newGame, rng, snapshot, step } from "../site/js/engine.js";
import { SCENARIOS } from "../site/js/scenarios.js";
import { drillRequest, planPayload, simulateDrill } from "../site/js/drills.js";
import { siteTick } from "../site/js/arcgis.js";

function businessHours(s, rand) {
  while (clock(s.tick).hour !== 15) step(s, rand);
}

const scenarios = SCENARIOS.map((sc) => {
  const s = newGame(11);
  const rand = rng(11);
  s.instance.public = false;
  businessHours(s, rand);
  sc.start(s, () => {});
  step(s, rand);
  siteTick(s, () => {}, 1, rand); // business-hours load on ArcGIS Server too
  const out = { id: sc.id, teaches: sc.teaches, via: sc.via || "snapshot", snapshot: snapshot(s) };
  if (sc.via === "drill-plan") {
    // the recovery request a player would make, with backups off (retention 0)
    const lost = s.db.lost[0];
    const off = structuredClone(s);
    off.instance.backupRetention = 0;
    off.db.snapshots = [];
    out.drillPlan = planPayload(off, drillRequest(off, { mode: "pitr", restoreTick: lost.tick, level: 6 }));
  }
  if (sc.via === "drill-evaluate") {
    out.drillEvaluate = simulateDrill(s, drillRequest(s, { level: 6 }), rand).payload;
  }
  return out;
});

// A normal drill plan and result for a healthy lab, for the parity test.
const healthy = newGame(12);
healthy.instance.backupRetention = 7;
const hreq = drillRequest(healthy, { level: 6 });
const drill = { plan: planPayload(healthy, hreq), evaluate: simulateDrill(healthy, hreq, rng(12)).payload };

const fresh = newGame(3);
step(fresh, rng(3));

// The takeover client at three points: as found, blockers cleared, promoted.
const tk = newGame(13);
tk.level = 14;
const { startTakeover, STEPS: TK, takeoverSnapshot } = await import("../site/js/takeover.js");
startTakeover(tk);
const asFound = structuredClone(takeoverSnapshot(tk));
for (const id of ["delete_try", "grow_storage", "kms_key"]) TK[id].finish(tk);
tk.takeover.client.regionAurora.push("17.6");
const cleared = structuredClone(takeoverSnapshot(tk));
TK.create_cluster.finish(tk);
Object.assign(tk.takeover.client.cluster, { lagGb: 0, state: "caught-up" });
tk.takeover.client.writes = false;
TK.promote.finish(tk);
const promoted = structuredClone(takeoverSnapshot(tk));
const withNow = (t) => ({ ...snapshot(tk), takeover: t });

console.log(JSON.stringify({
  actionCodes: Object.keys(ACTIONS),
  teaches: [...new Set(SCENARIOS.flatMap((x) => x.teaches))],
  fresh: snapshot(fresh),
  scenarios,
  drill,
  takeover: { asFound: withNow(asFound), cleared: withNow(cleared), promoted: withNow(promoted) },
}));
