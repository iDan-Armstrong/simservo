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

// The fleet with every site arrived, before any fixes.
const fl = newGame(14);
fl.takeover = { finished: true };
const { startFleet, ARRIVALS: FA } = await import("../site/js/fleet.js");
startFleet(fl);
const { ensureFleet } = await import("../site/js/fleet.js");
for (const spec of FA) ensureFleet(fl).members.push({ ...ensureFleet(fl).members[0], encrypted: true, arcgis: "12.1", production: false, engineVersion: "17.7", public: false, deletionProtection: true, backupRetention: 7, iamAuth: true, autoMinor: false, customParams: true, perfInsights: true, multiAz: false, cls: "db.t4g.medium", allocatedGb: 100, work: null, ...spec });
const fleetSnap = structuredClone(snapshot(fl));

// Security Operations: the posture as found and fully hardened, and the real playbook
// requests for every incident kind, plain and federal.
const sec = newGame(15);
sec.level = 15;
const SO = await import("../site/js/secops.js");
const { isoAt } = await import("../site/js/engine.js");
SO.startSecops(sec);
const secFound = structuredClone(snapshot(sec));
const hard = structuredClone(sec);
hard.instance.public = false;
for (const [code, list] of Object.entries(SO.SEC_ACTIONS)) for (const a of list) a.apply(hard, { code, title: "" });
const secHardened = structuredClone(snapshot(hard));
hard.takeover = { started: 0 };
const incidents = [...SO.RDSOPS_KINDS, ...SO.EGISOPS_KINDS].flatMap((k) => [false, true].map((fed) => ({
  kind: k, federal: fed, request: SO.incidentRequest(sec, k, fed, isoAt),
})));

console.log(JSON.stringify({
  actionCodes: Object.keys(ACTIONS),
  teaches: [...new Set(SCENARIOS.flatMap((x) => x.teaches))],
  fresh: snapshot(fresh),
  scenarios,
  drill,
  fleet: fleetSnap,
  takeover: { asFound: withNow(asFound), cleared: withNow(cleared), promoted: withNow(promoted) },
  security: { asFound: secFound, hardened: secHardened },
  incidents,
}));
