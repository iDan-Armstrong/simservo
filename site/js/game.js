// Game controller. No DOM here: the UI calls tick() and act(), and renders state.
// `evaluate(snapshot)` is injected: in the browser it is the real rdsops running in
// Pyodide; in unit tests it can be a stub.

import { clock, isDown, newGame, rng, snapshot, step } from "./engine.js";
import { ACTIONS } from "./actions.js";
import { features, levelForXp } from "./levels.js";
import { byId, roll } from "./scenarios.js";
import { XP, checkAchievements, checkQuests } from "./progression.js";

const RANK = { OK: 0, INFO: 1, WARN: 2, FAIL: 3 };

export function incidentKey(f) {
  const e = f.evidence || {};
  if (f.code === "HLT006") return `HLT006:${(f.title.match(/slot (\S+):/) || [])[1]}`;
  const id = e.table && e.column ? `${e.table}.${e.column}` : e.table || e.index || (e.indexes ? e.indexes.join("|") : "");
  return `${f.code}:${id}`;
}

export function sourcesFor(level) {
  const f = features(level);
  return new Set(["inventory", f.health && "health", f.maintenance && "maintenance", f.compat && "compat"].filter(Boolean));
}

export class Game {
  constructor({ state, evaluate, seed = 1, forceTrollzilla = false }) {
    this.s = state || newGame(seed);
    this.evaluate = evaluate;
    this.rand = rng((this.s.seed * 7919 + this.s.tick) >>> 0);
    this.findings = [];
    this.events = []; // drained by the UI each frame
    this.forceTrollzilla = forceTrollzilla;
    this.scan({ manual: false });
  }

  emit(kind, data) {
    this.events.push({ kind, ...data });
  }

  log(entry) {
    const { day, hour } = clock(this.s.tick);
    const line = { t: this.s.tick, stamp: `D${day} ${String(hour).padStart(2, "0")}:00`, ...entry };
    this.s.log.push(line);
    if (this.s.log.length > 400) this.s.log.splice(0, this.s.log.length - 400);
    this.emit("log", { line });
  }

  get level() {
    return this.s.level;
  }

  // ---------------------------------------------------------------- the clock
  tick() {
    const s = this.s;
    for (const n of step(s, this.rand)) this.log(n);
    this.finishPending();
    this.runScenarios();
    if (s.counters.trollzillaTick != null && !s.counters.survivedTrollzilla && s.tick - s.counters.trollzillaTick >= 168) {
      s.counters.survivedTrollzilla = true;
    }
    this.scan({ manual: false });
  }

  runScenarios() {
    const s = this.s;
    const f = features(s.level);
    // end scenarios whose time is up
    s.scenarios.active = s.scenarios.active.filter((a) => {
      if (a.endsAt != null && s.tick >= a.endsAt) {
        const sc = byId(a.id);
        if (sc && sc.end) sc.end(s);
        if (!isDown(s)) this.award(XP.scenarioSurvived, `Rode out: ${sc ? sc.title : a.id}`);
        return false;
      }
      return true;
    });
    let next = null;
    if (this.forceTrollzilla) {
      next = byId("trollzilla");
      this.forceTrollzilla = false;
    } else if (f.scenarios) {
      next = roll(s, s.level, this.rand, f.scenarioRate);
    }
    if (!next) return;
    s.scenarios.history.push({ id: next.id, tick: s.tick });
    if (next.duration) s.scenarios.active.push({ id: next.id, endsAt: s.tick + next.duration });
    this.log({ kind: next.id === "trollzilla" ? "monster" : "scenario", text: `${next.title}. ${next.blurb}` });
    next.start(s, (e) => this.log(e));
    if (next.id === "trollzilla") {
      s.counters.trollzillaTick = s.tick;
      this.emit("trollzilla", {});
    }
  }

  // ------------------------------------------------------------ scanning
  scan({ manual }) {
    const s = this.s;
    const allowed = sourcesFor(s.level);
    const snap = snapshot(s, { production: features(s.level).production });
    const all = this.evaluate(snap);
    this.findings = all.filter((x) => allowed.has(x.source));
    if (manual) {
      s.counters.scans = (s.counters.scans || 0) + 1;
      this.log({ kind: "scan", text: `Scan complete: ${this.summary()}` });
    }
    this.reconcile();
    const problems = this.findings.filter((x) => RANK[x.severity] >= RANK.WARN);
    s.counters.inventoryClean = !this.findings.some((x) => x.source === "inventory" && RANK[x.severity] >= RANK.WARN);
    if (s.level >= 3 && !problems.length && !isDown(s)) s.counters.cleanScan = true;
    this.progress();
  }

  summary() {
    const n = (sev) => this.findings.filter((x) => x.severity === sev).length;
    return `${n("FAIL")} FAIL, ${n("WARN")} WARN, ${n("INFO")} info, ${n("OK")} ok`;
  }

  reconcile() {
    const s = this.s;
    const live = new Map();
    for (const f of this.findings) if (RANK[f.severity] >= RANK.WARN) live.set(incidentKey(f), f);
    for (const [key, f] of live) {
      if (!s.incidents[key]) {
        s.incidents[key] = { code: f.code, severity: f.severity, since: s.tick, title: f.title };
        this.log({ kind: f.severity === "FAIL" ? "fail" : "warn", text: `${f.code} ${f.severity}: ${f.title}` });
      } else if (RANK[f.severity] > RANK[s.incidents[key].severity]) {
        s.incidents[key].severity = f.severity;
      }
    }
    for (const key of Object.keys(s.incidents)) {
      if (live.has(key)) continue;
      const inc = s.incidents[key];
      delete s.incidents[key];
      if (isDown(s) && !key.startsWith("INV")) continue; // went quiet because we cannot connect, not fixed
      s.counters.resolved = s.counters.resolved || {};
      s.counters.resolved[inc.code] = (s.counters.resolved[inc.code] || 0) + 1;
      const { hour } = clock(s.tick);
      if (hour < 5) s.counters.nightFix = true;
      this.award(XP[inc.severity] || 10, `Resolved ${inc.code}: ${inc.title}`);
    }
  }

  award(xp, why) {
    this.s.xp += xp;
    this.log({ kind: "xp", text: `+${xp} XP  ${why}` });
  }

  progress() {
    const s = this.s;
    for (const q of checkQuests(s)) {
      this.log({ kind: "quest", text: `Quest complete: ${q.title}` });
      s.xp += XP.quest;
      this.emit("quest", { quest: q });
    }
    for (const a of checkAchievements(s)) {
      this.log({ kind: "achievement", text: `Achievement: ${a.title}` });
      this.emit("achievement", { achievement: a });
    }
    const lvl = levelForXp(s.xp);
    if (lvl > s.level) {
      const from = s.level;
      s.level = lvl;
      this.log({ kind: "level", text: `Level ${lvl}!` });
      this.emit("level", { from, to: lvl });
    }
  }

  // ------------------------------------------------------------- actions
  busy() {
    return Boolean(this.s.pending);
  }

  act(finding, actionId) {
    const s = this.s;
    if (this.busy()) return { ok: false, reason: "Already working on something." };
    const action = (ACTIONS[finding.code] || []).find((a) => a.id === actionId);
    if (!action) return { ok: false, reason: "No such action." };
    if (s.budget < action.cost) return { ok: false, reason: "Not enough budget." };
    s.budget -= action.cost;
    const command = action.command(finding, s);
    this.log({ kind: "action", text: `$ ${command}` });
    if (action.hours > 0) {
      s.pending = { code: finding.code, actionId, finding, completeAt: s.tick + action.hours, label: action.label };
    } else {
      action.apply(s, finding);
      this.scan({ manual: false });
    }
    return { ok: true, command };
  }

  finishPending() {
    const s = this.s;
    if (!s.pending || s.tick < s.pending.completeAt) return;
    const p = s.pending;
    s.pending = null;
    const action = (ACTIONS[p.code] || []).find((a) => a.id === p.actionId);
    if (action) action.apply(s, p.finding);
    this.log({ kind: "done", text: `Done: ${p.label}` });
  }

  manualScan() {
    this.scan({ manual: true });
  }
}
