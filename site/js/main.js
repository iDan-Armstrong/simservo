// Entry point: setup wizard, then the game loop.

import { bootPython } from "./bridge.js";
import { Game } from "./game.js";
import { newGame } from "./engine.js";
import { UPGRADES, ACTIONS } from "./actions.js";
import { LEVELS } from "./levels.js";
import { appendLog, careerHtml, glossaryHtml, modal, renderAll, showTutorial, toast, wireGlossarySearch } from "./ui.js";
import { installTooltips } from "./tooltip.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FAST = params.has("fast");
const SAVE_KEY = "simservo.save.v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));

// --------------------------------------------------------------- storage
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: play without saving */ }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- wizard
const term = $("wiz-term");
function say(text, cls = "") {
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = `${text}\n`;
  term.appendChild(span);
  term.scrollTop = term.scrollHeight;
}
function stepState(name, state) {
  const li = document.querySelector(`#wiz-steps li[data-step="${name}"]`);
  li.classList.remove("active", "done", "failed");
  if (state) li.classList.add(state);
}
function bar(pct, bytesText = "") {
  $("wiz-fill").style.width = `${pct}%`;
  document.querySelector(".wiz-bar").setAttribute("aria-valuenow", String(Math.round(pct)));
  $("wiz-bytes").textContent = bytesText || " ";
}
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

async function runWizard() {
  stepState("post", "active");
  for (const line of ["SIMServo controller BIOS 0.1", "Checking memory........ 640K (should be enough for anyone)", "Checking memory........ just kidding, 4096 MB OK", "Detecting network...... 1 VPC, 1 ArcGIS Server, 1 RDS instance", "Detecting coffee....... LOW"]) {
    say(line);
    await sleep(260);
  }
  stepState("post", "done");
  stepState("firmware", "active");
  say("Requesting controller firmware (Python 3 for WebAssembly)...");
  let lastPct = -1;
  const engine = await bootPython({
    onStage(name, info) {
      if (name === "firmware") {
        const pct = info.total ? (100 * info.loaded) / info.total : 0;
        bar(pct * 0.7, `${mb(info.loaded)}${info.total ? ` of ${mb(info.total)}` : ""}  firmware`);
        if (Math.floor(pct / 25) !== lastPct) { lastPct = Math.floor(pct / 25); if (pct > 1) say(`  firmware ${Math.min(100, Math.round(pct))}%`); }
      } else if (name === "flash") {
        if (info.state === "start") { stepState("firmware", "done"); stepState("flash", "active"); say("Flashing firmware. Do not unplug the internet."); bar(72, "flashing"); }
        else { stepState("flash", "done"); stepState("rules", "active"); say(`Firmware OK: Python ${info.python}`); }
      } else if (name === "rules") {
        bar(75 + (20 * info.loaded) / Math.max(1, info.total), `${mb(info.loaded)} rules engine`);
      } else if (name === "selftest") {
        stepState("rules", "done");
        stepState("selftest", "active");
        say("Self-test: asking the rules engine about PostgreSQL 16.4 + PostGIS 3.5.3 on ArcGIS 12.1");
        for (const l of info.lines) say(`  ${l}`, l.includes("FAIL") ? "fail" : l.includes("WARN") ? "warn" : "");
      }
    },
  });
  await sleep(500);
  say(`Self-test passed: ${engine.rdsopsVersion} loaded; the rules engine found the problems it should.`);
  stepState("selftest", "done");
  stepState("callsign", "active");
  bar(100, "ready");
  const save = loadSave();
  $("wiz-resume").textContent = save ? `A saved shift was found (${save.callsign}, level ${save.level}). Begin shift resumes it; type a new callsign to start over.` : "";
  if (save) $("callsign").value = save.callsign;
  $("wiz-form").classList.remove("hidden");
  $("callsign").focus();
  const callsign = await new Promise((resolve) => {
    $("wiz-form").addEventListener("submit", (e) => {
      e.preventDefault();
      resolve(($("callsign").value || "OPS-1").trim().toUpperCase().slice(0, 20));
    }, { once: true });
  });
  stepState("callsign", "done");
  return { engine, callsign, save };
}

// ------------------------------------------------------------------ game
let speed = 1;
let timer = null;
let game = null;

function setSpeed(n) {
  speed = n;
  document.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("on", Number(b.dataset.speed) === n));
  clearInterval(timer);
  if (n > 0) timer = setInterval(frame, 2000 / n);
}

async function withPause(fn) {
  const was = speed;
  setSpeed(0);
  try { return await fn(); } finally { setSpeed(was); }
}

function drain() {
  const events = game.events.splice(0);
  const queue = [];
  for (const e of events) {
    if (e.kind === "log") appendLog(e.line);
    else if (e.kind === "quest") toast("Quest complete", e.quest.title);
    else if (e.kind === "achievement") toast("Achievement", `${e.achievement.title}: ${e.achievement.desc}`);
    else if (e.kind === "level") queue.push(() => levelUp(e.from, e.to));
    else if (e.kind === "trollzilla") queue.push(trollzilla);
    else if (e.kind === "fleet" && e.started) queue.push(() => showTutorial("fleet"));
    else if (e.kind === "secops" && e.incident && !game.s.counters.incidentTutorial) {
      game.s.counters.incidentTutorial = true;
      queue.push(() => showTutorial("incident"));
    }
    else if (e.kind === "fleet" && e.arrival) toast("New site", `${e.arrival} joined your fleet`);
    else if (e.kind === "takeover") queue.push(() => showTutorial(e.finale ? "takeover-finale" : `takeover-${e.chapter}`));
    else if (e.kind === "campaign") queue.push(() => showTutorial(e.finale ? "expansion-finale" : `expansion-${e.chapter}`));
  }
  if (queue.length) withPause(async () => { for (const q of queue) await q(); });
}

async function levelUp(from, to) {
  for (let n = from + 1; n <= to; n++) {
    const l = LEVELS[n - 1];
    await modal({
      title: `LEVEL ${n}: ${l.title}`,
      html: `<p>Tier ${l.tier}: ${l.tierName}.</p>${l.unlocks.length ? `<h4>New</h4><ul>${l.unlocks.map((u) => `<li>${u}</li>`).join("")}</ul>` : ""}`,
      actions: [{ label: l.tutorial ? "Show me" : "Continue", value: "ok", primary: true }],
    });
    if (l.tutorial) await showTutorial(l.tutorial);
  }
}

function trollzilla() {
  return new Promise((resolve) => {
    $("troll").classList.remove("hidden");
    $("troll-ok").onclick = () => { $("troll").classList.add("hidden"); resolve(); };
  });
}

function frame() {
  if (game.s.secops && game.s.secops.incident) return; // the world waits while you respond
  game.tick();
  drain();
  renderAll(game, handlers);
  writeSave(game.s);
}

const handlers = {
  act(finding, actionId) {
    const r = game.act(finding, actionId);
    if (!r.ok) toast("Can't do that", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  drill(mode) {
    const r = game.runDrill(mode);
    if (!r.ok) toast("Drill not run", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  fleet(memberId, fixId) {
    const r = game.fleetAct(memberId, fixId);
    if (!r.ok) toast("Not now", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  takeover(id) {
    const r = game.takeoverAct(id);
    if (!r.ok) toast("Not yet", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  campaign(id) {
    const r = game.campaignAct(id);
    if (!r.ok) toast("Not yet", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  drDrill(kind) {
    const r = game.runFailoverDrill(kind);
    if (!r.ok) toast("Drill not run", r.reason);
    drain(); renderAll(game, handlers); writeSave(game.s);
  },
  drTtl() {
    const r = game.fixDnsTtl();
    if (!r.ok) toast("Not now", r.reason);
    drain(); renderAll(game, handlers); writeSave(game.s);
  },
  drFailover(i) {
    const r = game.failOverRegion(i);
    if (r && !r.ok) toast("Not now", r.reason);
    drain(); renderAll(game, handlers); writeSave(game.s);
  },
  incidentStep(n) {
    const r = game.incidentStep(n);
    if (!r.ok) toast("Not yet", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  async incidentClose() {
    const inc = game.s.secops.incident;
    const r = game.closeIncident();
    if (!r.ok) { toast("Not yet", r.reason); return; }
    renderAll(game, handlers);
    writeSave(game.s);
    await withPause(() => modal({
      title: `Incident ${inc.id} closed`,
      html: `<p>${inc.minute} minutes. Impact ${r.cost.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. +${r.xp} XP.</p>
        ${inc.penalties.length ? `<h4>What went wrong</h4><ul>${inc.penalties.map((p) => `<li>${p.text.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : "<p>A clean response.</p>"}
        ${inc.notes.length ? `<h4>Contingencies</h4><ul>${inc.notes.map((t) => `<li>${t.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : ""}
        <p class="small dim">Next: the review step's real command is what you run after an incident like this.</p>`,
      actions: [{ label: "Back to work", value: 1, primary: true }],
    }));
    drain();
    renderAll(game, handlers);
  },
  recover(name) {
    const r = game.recoverTable(name);
    if (!r.ok) toast("Restore not possible", r.reason);
    drain();
    renderAll(game, handlers);
    writeSave(game.s);
  },
  upgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const actionId = u.action || ACTIONS[u.code][0].id;
    const f = game.findings.find((x) => x.code === u.code) || { code: u.code, title: u.label, evidence: {} };
    handlers.act(f, actionId);
  },
};

installTooltips();

// Quit: save, stop the clock and leave the operations center. Nothing is lost,
// so the confirm step only guards against a stray click.
let speedBeforeQuit = 1;
async function quitShift() {
  const was = speed;
  setSpeed(0);
  const go = await modal({
    title: "End your shift?",
    html: `<p>The clock stops and your progress is saved in this browser. Begin shift as ${game.s.callsign.replace(/</g, "&lt;")} next time to pick up where you left off.</p>`,
    actions: [
      { label: "Save and quit", value: true, primary: true },
      { label: "Keep playing", value: false },
    ],
  });
  if (!go) { setSpeed(was); return; }
  speedBeforeQuit = was || 1;
  writeSave(game.s);
  $("quit-summary").textContent = `${game.s.callsign}, level ${game.s.level}. Shift saved.`;
  $("game").classList.add("hidden");
  $("quit").classList.remove("hidden");
  $("quit-resume").focus();
}

async function start() {
  const { engine, callsign, save } = await runWizard();
  const resume = save && save.callsign === callsign && !params.has("new");
  if (!resume) clearSave();
  const seed = Number(params.get("seed")) || Math.floor(Math.random() * 1e9);
  game = new Game({
    state: resume ? save : newGame(seed, callsign),
    rules: engine,
    forceTrollzilla: params.has("trollzilla"),
  });
  window.simservo = game; // for the curious, and for the end-to-end test
  $("wizard").classList.add("hidden");
  $("game").classList.remove("hidden");
  game.events = game.events.filter((e) => e.kind !== "log"); // the saved log below already has them
  for (const line of game.s.log.slice(-80)) appendLog(line);
  drain();
  renderAll(game, handlers);
  document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => setSpeed(Number(b.dataset.speed))));
  $("btn-scan").addEventListener("click", () => { game.manualScan(); drain(); renderAll(game, handlers); });
  $("btn-help").addEventListener("click", () => withPause(() => showTutorial("intro")));
  $("btn-glossary").addEventListener("click", () => withPause(() => {
    const shown = modal({ title: "Glossary", html: glossaryHtml(), actions: [{ label: "Close", value: 1, primary: true }] });
    wireGlossarySearch();
    return shown;
  }));
  $("btn-career").addEventListener("click", () => withPause(() => modal({ title: "Career path", html: careerHtml(game.s), actions: [{ label: "Close", value: 1, primary: true }] })));
  $("btn-quit").addEventListener("click", quitShift);
  $("quit-resume").addEventListener("click", () => {
    $("quit").classList.add("hidden");
    $("game").classList.remove("hidden");
    setSpeed(speedBeforeQuit);
    $("btn-quit").focus();
  });
  if (!resume && !params.has("skipintro")) await showTutorial("intro");
  setSpeed(Number(params.get("speed") ?? 1));
}

start().catch((err) => {
  say(`ERROR: ${err.message}`, "fail");
  document.querySelectorAll("#wiz-steps li.active").forEach((li) => li.classList.replace("active", "failed"));
  say("Setup could not finish. Reload the page to try again.", "warn");
  console.error(err);
});
