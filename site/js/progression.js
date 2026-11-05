// Quests, achievements and XP rules.

import { isDown } from "./engine.js";

export const XP = { FAIL: 40, WARN: 15, quest: 50, scenarioSurvived: 25, expansion: 600 };

const resolvedCodes = (s) => s.counters.resolved || {};

export const QUESTS = [
  { id: "q_scan", title: "Know your instance", goal: "Run an inventory scan", minLevel: 1, done: (s) => (s.counters.scans || 0) >= 1 },
  { id: "q_lock", title: "Lock the front door", goal: "Turn off public access (INV002)", minLevel: 1, done: (s) => !s.instance.public },
  { id: "q_params", title: "Turn on the lights", goal: "Attach the custom parameter group (INV009)", minLevel: 2, done: (s) => s.instance.customParams },
  { id: "q_backup", title: "Seven days of yesterday", goal: "Keep 7 days of backups (INV004)", minLevel: 2, done: (s) => s.instance.backupRetention >= 7 },
  { id: "q_protect", title: "No accidental deletes", goal: "Turn on deletion protection (INV003)", minLevel: 2, done: (s) => s.instance.deletionProtection },
  { id: "q_day", title: "First full day", goal: "Keep the database up for 24 game hours", minLevel: 1, done: (s) => s.uptime.up >= 24 },
  { id: "q_index", title: "Index the laterals", goal: "Fix a spatial column with no index (MNT006)", minLevel: 3, done: (s) => (resolvedCodes(s).MNT006 || 0) >= 1 },
  { id: "q_minor", title: "Patch on your schedule", goal: "Turn off auto minor upgrades (INV008)", minLevel: 4, done: (s) => !s.instance.autoMinor },
  { id: "q_clean", title: "Clean bill of health", goal: "A full scan with no WARN or FAIL", minLevel: 3, done: (s) => Boolean(s.counters.cleanScan) },
  { id: "q_trust", title: "Trust me", goal: "Replace the self-signed certificate on ArcGIS Server (SRV006)", minLevel: 4, done: (s) => Boolean(s.arcgis && s.arcgis.cert.trusted) },
  { id: "q_quiet_logs", title: "Quiet logs", goal: "A full day with no SEVERE entries in the ArcGIS Server logs (LOG001)", minLevel: 5, done: (s) => Boolean(s.counters.quietLogs) },
  { id: "q_drill", title: "Prove your backups", goal: "Pass a restore drill with no warnings (DRL)", minLevel: 6, done: (s) => (s.counters.cleanDrills || 0) >= 1 },
  { id: "q_federation", title: "Federation checks out", goal: "A portal scan where the hosting server validates (PTL008)", minLevel: 9, done: (s) => Boolean(s.counters.federationOk) },
  { id: "q_two_of_everything", title: "Two of everything", goal: "Run a second portal machine and a Data Store standby (PTL003, DST003)", minLevel: 10, done: (s) => Boolean(s.arcgis && s.arcgis.portal.machines.length > 1 && s.arcgis.datastore.machines.length > 1) },
  { id: "q_nightly", title: "Every night at two", goal: "Schedule WebGISDR and finish a backup (BAK010)", minLevel: 11, done: (s) => Boolean(s.arcgis && s.arcgis.webgisdr.scheduled && s.arcgis.webgisdr.backups.length) },
  { id: "q_week", title: "Week one", goal: "Survive seven game days", minLevel: 3, done: (s) => s.tick >= 24 * 7 },
];

export const ACHIEVEMENTS = [
  { id: "first_responder", title: "First Responder", desc: "Resolve your first finding.", test: (s) => Object.values(resolvedCodes(s)).reduce((a, b) => a + b, 0) >= 1 },
  { id: "fort_knox", title: "Fort Knox", desc: "No inventory warnings or failures.", test: (s) => Boolean(s.counters.inventoryClean) },
  { id: "vacuum_cleaner", title: "Vacuum Cleaner", desc: "Run VACUUM five times.", test: (s) => (s.counters.vacuums || 0) >= 5 },
  { id: "index_whisperer", title: "Index Whisperer", desc: "Build three spatial indexes.", test: (s) => (s.counters.gist || 0) >= 3 },
  { id: "slot_machine", title: "Slot Machine", desc: "Drop an orphaned replication slot.", test: (s) => (s.counters.slotsDropped || 0) >= 1 },
  { id: "night_shift", title: "Night Shift", desc: "Fix something between midnight and 5 a.m. game time.", test: (s) => Boolean(s.counters.nightFix) },
  { id: "by_the_runbook", title: "By the Runbook", desc: "A bad patch arrives and your settings hold it back.", test: (s) => (s.counters.heldUpgrade || 0) >= 1 },
  { id: "belt_and_suspenders", title: "Belt and Suspenders", desc: "Survive an AZ outage with Multi-AZ.", test: (s) => (s.counters.failovers || 0) >= 1 },
  { id: "penny_pincher", title: "Penny Pincher", desc: "Hold a budget over $1,500.", test: (s) => s.budget >= 1500 },
  { id: "three_nines", title: "Three Nines", desc: "99.9% uptime over at least a week.", test: (s) => s.tick >= 168 && s.uptime.up / (s.uptime.up + s.uptime.down) >= 0.999 },
  { id: "proven_backups", title: "Proven Backups", desc: "Pass a restore drill.", test: (s) => (s.counters.cleanDrills || 0) >= 1 },
  { id: "undo_button", title: "Undo Button", desc: "Recover a dropped table with point-in-time restore.", test: (s) => (s.counters.recovered || 0) >= 1 },
  { id: "auditor_approved", title: "Auditor Approved", desc: "Answer an audit with a passing drill.", test: (s) => (s.counters.auditPassed || 0) >= 1 },
  { id: "green_padlock", title: "Green Padlock", desc: "Serve maps with a trusted certificate.", test: (s) => (s.counters.trustedCert || 0) >= 1 },
  { id: "keeper_of_keys", title: "Keeper of Keys", desc: "Renew a license before it expires.", test: (s) => (s.counters.licenseRenewals || 0) >= 1 },
  { id: "pool_shark", title: "Pool Shark", desc: "Tune an instance pool that was maxed out.", test: (s) => (s.counters.poolsTuned || 0) >= 1 },
  { id: "found_it", title: "Found It", desc: "Rebuild the portal search index.", test: (s) => (s.counters.reindexed || 0) >= 1 },
  { id: "back_online", title: "Back Online", desc: "Bring ArcGIS Data Store back after hosted layers went dark.", test: (s) => (s.counters.dataStoreStarts || 0) >= 1 },
  { id: "whole_site", title: "The Whole Site", desc: "Finish five WebGISDR exports.", test: (s) => (s.arcgis && s.arcgis.webgisdr.runs.filter((r) => r.status === "success").length >= 5) || (s.counters.wgExports || 0) >= 5 },
  { id: "twelve_one", title: "Twelve One", desc: "Finish the expansion: upgrade the whole stack to ArcGIS Enterprise 12.1.", test: (s) => Boolean(s.campaign && s.campaign.finished) },
  { id: "by_the_book", title: "By the Book", desc: "Have an upgrade step refused for being out of Esri's order.", hidden: true, test: (s) => (s.counters.outOfOrder || 0) >= 1 },
  { id: "tier_one", title: "Tier One", desc: "Reach level 10.", test: (s) => s.level >= 10 },
  { id: "it_is_real", title: "It Is Real", desc: "See Trollzilla.", hidden: true, test: (s) => (s.counters.trollzilla || 0) >= 1 },
  { id: "trollzilla_survivor", title: "Trollzilla Survivor", desc: "Still standing a week after Trollzilla.", hidden: true, test: (s) => Boolean(s.counters.survivedTrollzilla) },
];

export function checkQuests(s) {
  const fresh = [];
  for (const q of QUESTS) {
    if (s.level >= q.minLevel && !s.quests.includes(q.id) && q.done(s)) {
      s.quests.push(q.id);
      fresh.push(q);
    }
  }
  return fresh;
}

export function checkAchievements(s) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements.includes(a.id) && a.test(s)) {
      s.achievements.push(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}

export function activeQuests(s) {
  return QUESTS.filter((q) => s.level >= q.minLevel && !s.quests.includes(q.id));
}

export function uptimePct(s) {
  const t = s.uptime.up + s.uptime.down;
  return t ? (100 * s.uptime.up) / t : 100;
}

export { isDown };
