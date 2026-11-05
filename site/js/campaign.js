// Expansion 1: The 12.1 Upgrade. A campaign that opens at level 12, when egisops
// stack-compat starts reading what the site really runs. The campaign only changes the
// simulated system and tracks progress; whether the stack is right is still decided by the
// real stack-compat (and rdsops compat inside it).
//
// The steps follow Esri's "Upgrade ArcGIS Enterprise": back up first, move off features
// retired at 12.0, then Portal, the hosting server and ArcGIS Data Store, in that order.

import { ensureSite, ensureWebgisdr } from "./arcgis.js";

export const TARGET = "12.1";
const V = "12.1.0";

export const CHAPTERS = [
  { n: 1, title: "Prepare", goal: "A fresh WebGISDR backup, and no Web AppBuilder apps left" },
  { n: 2, title: "Upgrade in order", goal: "Portal, then the hosting server, then ArcGIS Data Store" },
  { n: 3, title: "Finish", goal: "ArcGIS Pro to its companion version and a clean stack-compat scan" },
];

export const STEPS = {
  migrate_wab: {
    label: "Rebuild 2 Web AppBuilder apps in Experience Builder", hours: 4, chapter: 1,
    command: "Experience Builder > create from the old app's maps and widgets; share; retire the Web AppBuilder item",
    blocked: (s) => (s.arcgis.portal.wabApps > 0 ? null : "No Web AppBuilder apps are left."),
  },
  upgrade_portal: {
    label: "Upgrade Portal for ArcGIS to 12.1", hours: 4, chapter: 2,
    command: "Run the Portal for ArcGIS 12.1 setup on each portal machine, then upgrade its Web Adaptor",
    blocked: (s) =>
      !backupFresh(s) ? "Esri: take a backup of ArcGIS Enterprise before upgrading any component. The newest WebGISDR backup is missing, failed or older than 24 hours."
      : s.arcgis.portal.wabApps > 0 ? "Esri: migrate away from features retired at 12.0 while still on 11.5. Web AppBuilder apps are left."
      : s.arcgis.portal.version === V ? "Portal is already on 12.1." : null,
    start(s) { for (const m of s.arcgis.portal.machines) m.ready = false; },
    finish(s) { const p = s.arcgis.portal; p.version = V; for (const m of p.machines) m.ready = true; },
  },
  upgrade_server: {
    label: "Upgrade the hosting server to 12.1", hours: 3, chapter: 2,
    command: "Run the ArcGIS Server 12.1 setup on every machine in the site, then upgrade its Web Adaptor",
    blocked: (s) =>
      s.arcgis.portal.version !== V ? "Esri's order: upgrade Portal for ArcGIS before the hosting server."
      : s.arcgis.version === V ? "The hosting server is already on 12.1." : null,
    start(s) { for (const m of s.arcgis.machines) m.realtime = "STOPPED"; },
    finish(s) { const a = s.arcgis; a.version = V; for (const m of a.machines) { m.realtime = "STARTED"; m.configured = "STARTED"; } },
  },
  upgrade_datastore: {
    label: "Upgrade ArcGIS Data Store to 12.1", hours: 3, chapter: 2,
    command: "Install ArcGIS Data Store 12.1 on every data store machine, apply the 12.1 Relational Store Upgrade Patch, then run configuredatastore",
    blocked: (s) =>
      s.arcgis.version !== V ? "Esri: upgrade the hosting server before ArcGIS Data Store."
      : s.arcgis.datastore.release === V ? "ArcGIS Data Store is already on 12.1." : null,
    start(s) { for (const m of s.arcgis.datastore.machines) m.up = false; },
    finish(s) { const d = s.arcgis.datastore; d.release = V; for (const m of d.machines) m.up = true; },
  },
  rollout_pro: {
    label: "Roll out ArcGIS Pro 3.7 to the editors", hours: 6, chapter: 3,
    command: "Deploy ArcGIS Pro 3.7 (the companion of Enterprise 12.1) with your software distribution tool",
    blocked: (s) =>
      s.arcgis.datastore.release !== V ? "Finish the base deployment upgrade first."
      : s.arcgis.proVersion === "3.7" ? "ArcGIS Pro 3.7 is already rolled out." : null,
    finish(s) { s.arcgis.proVersion = "3.7"; },
  },
};

export function ensureCampaign(s) {
  const a = ensureSite(s);
  if (!a.proVersion) a.proVersion = "3.5";
  if (a.portal.wabApps == null) a.portal.wabApps = 6;
  if (!s.campaign) s.campaign = { id: "upgrade-12.1", started: null, chapter: 1, work: null, finished: false };
  return s.campaign;
}

export function backupFresh(s) {
  const w = ensureWebgisdr(s);
  const last = w.backups[w.backups.length - 1];
  const run = w.runs[w.runs.length - 1];
  return Boolean(last && s.tick - last.tick <= 24 && run && run.status === "success");
}

export function available(s, id) {
  const c = ensureCampaign(s);
  const step = STEPS[id];
  if (c.started == null || c.finished) return "The campaign is not running.";
  if (c.work) return "A campaign step is already in progress.";
  if (step.chapter > c.chapter) return "Finish the current chapter first.";
  return step.blocked(s);
}

export function startStep(s, id, log) {
  const why = available(s, id);
  if (why) {
    if (why.startsWith("Esri's order") || why.startsWith("Esri: upgrade the hosting server")) s.counters.outOfOrder = (s.counters.outOfOrder || 0) + 1;
    return { ok: false, reason: why };
  }
  const step = STEPS[id];
  const c = s.campaign;
  c.work = { id, until: s.tick + step.hours };
  if (step.start) step.start(s);
  log({ kind: "action", text: `$ ${step.command}` });
  log({ kind: "info", text: `${step.label}: ${step.hours} hours.` });
  return { ok: true };
}

// Advances work and chapters. Returns events for the UI: chapter and finale.
export function campaignTick(s, log) {
  const c = ensureCampaign(s);
  const events = [];
  if (c.started == null) return events;
  if (c.work && s.tick >= c.work.until) {
    const step = STEPS[c.work.id];
    if (c.work.id === "migrate_wab") s.arcgis.portal.wabApps = Math.max(0, s.arcgis.portal.wabApps - 2);
    if (step.finish) step.finish(s);
    log({ kind: "info", text: `Done: ${step.label}.` });
    c.work = null;
  }
  const a = s.arcgis;
  if (c.chapter === 1 && backupFresh(s) && a.portal.wabApps === 0) {
    c.chapter = 2;
    events.push({ chapter: 2 });
  }
  if (c.chapter === 2 && a.portal.version === V && a.version === V && a.datastore.release === V && !c.work) {
    c.chapter = 3;
    events.push({ chapter: 3 });
  }
  return events;
}

// Finished when Pro is the companion and the real stack-compat scan has nothing at WARN or
// above. Called by the game after each scan with that scan's findings.
export function checkFinale(s, findings) {
  const c = ensureCampaign(s);
  if (c.started == null || c.finished || c.chapter !== 3 || c.work || s.arcgis.proVersion !== "3.7") return false;
  const stack = findings.filter((f) => f.source === "stack-compat");
  if (!stack.length || stack.some((f) => f.severity === "WARN" || f.severity === "FAIL")) return false;
  c.finished = true;
  c.finishedTick = s.tick;
  return true;
}

// Same field names as egisops.stack.StackSnapshot.
export function stackSnapshot(s) {
  const c = ensureCampaign(s);
  const a = s.arcgis;
  return {
    components: [
      { name: "Portal for ArcGIS", version: a.portal.version },
      { name: "ArcGIS Server (hosting)", version: a.version },
      { name: `ArcGIS Data Store (${a.datastore.name})`, version: a.datastore.release },
    ],
    engine_version: s.instance.engineVersion,
    postgis_version: s.instance.postgis,
    pro_version: a.proVersion,
    target: c.finished ? null : TARGET,
    errors: [],
  };
}
