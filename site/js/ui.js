// Rendering. Reads game state, writes DOM. No game rules here.

import { GIB, clock, freeBytes, isDown, maxConnections, monthlyCost } from "./engine.js";
import { actionsFor, UPGRADES } from "./actions.js";
import { LEVELS, TIERS, features, xpForLevel } from "./levels.js";
import { ACHIEVEMENTS, activeQuests, uptimePct } from "./progression.js";
import { TUTORIALS } from "./tutorials.js";
import { TERMS, annotate, lookup } from "./glossary.js";
import { CHAPTERS, STEPS, available, backupFresh } from "./campaign.js";
import * as TK from "./takeover.js";
import { FIXES } from "./fleet.js";

// Native SVG hover title from the glossary, for the network map.
const svgTitle = (term, extra = "") => `<title>${esc(`${lookup(term).term}: ${lookup(term).def}${extra ? ` ${extra}` : ""}`)}</title>`;

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Escaped text with glossary terms marked for hover help. Never use for commands.
const rich = (t) => annotate(esc(t));
const CLIENT_SOURCES = new Set(["aurora-plan", "client-compat"]);
const EGISOPS_SOURCES = new Set(["server-health", "services", "logs", "portal-health", "datastore", "backup-check", "stack-compat"]);
const money = (n) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const RANK = { FAIL: 0, WARN: 1, INFO: 2, OK: 3 };

let openKey = null;

export function renderAll(game, handlers) {
  renderHud(game);
  renderMap(game);
  renderFindings(game, handlers);
  renderSide(game, handlers);
}

function renderHud(game) {
  const s = game.s;
  const { day, hour } = clock(s.tick);
  $("hud-callsign").textContent = s.callsign;
  $("hud-clock").textContent = `D${day} ${String(hour).padStart(2, "0")}:00 UTC`;
  $("hud-budget").textContent = money(s.budget);
  $("hud-budget").style.color = s.budget < 0 ? "var(--fail)" : "";
  $("hud-bill").textContent = `${money(monthlyCost(s))}/mo`;
  $("hud-uptime").textContent = `${uptimePct(s).toFixed(2)}%`;
  const lv = LEVELS[s.level - 1];
  $("hud-level").textContent = `LV ${s.level}`;
  $("hud-title").textContent = lv.title;
  const lo = xpForLevel(s.level), hi = xpForLevel(Math.min(100, s.level + 1));
  const pct = s.level >= 100 ? 100 : (100 * (s.xp - lo)) / Math.max(1, hi - lo);
  $("hud-xp").style.width = `${Math.max(0, Math.min(100, pct))}%`;
  $("hud-xptext").textContent = s.level >= 100 ? `${s.xp} XP (max)` : `${s.xp.toLocaleString()} / ${hi.toLocaleString()} XP`;
}

function renderMap(game) {
  const s = game.s;
  const inst = s.instance;
  const down = isDown(s);
  const color = down ? "var(--fail)" : "var(--ok)";
  const shield = inst.public ? "var(--fail)" : "var(--ok)";
  const storm = s.db.extraConnections > 0;
  const ags = s.arcgis;
  const machinesUp = ags.machines.filter((m) => m.realtime === "STARTED").length;
  const agsUp = machinesUp > 0;
  const agsColor = agsUp ? "var(--cyan)" : "var(--fail)";
  const svcs = ags.services || [];
  const svcUp = agsUp ? svcs.filter((x) => x.realtime === "STARTED").length : 0;
  const svcDown = svcUp < svcs.filter((x) => x.configured === "STARTED").length;
  const svcHot = svcs.some((x) => x.realtime === "STARTED" && x.max && x.busy >= x.max);
  const standby = inst.multiAz
    ? `<g>${svgTitle("Multi-AZ")}<rect x="300" y="250" width="100" height="56" rx="8" fill="#120a2a" stroke="var(--cyan)" stroke-dasharray="4 3"/>
       <text x="350" y="274" fill="var(--cyan)" font-size="11" text-anchor="middle">standby</text>
       <text x="350" y="290" fill="var(--dim)" font-size="10" text-anchor="middle">us-east-1b</text>
       <line x1="300" y1="240" x2="330" y2="250" stroke="var(--cyan)" stroke-dasharray="3 3"/></g>`
    : "";
  const feat = features(s.level);
  const portal = ags.portal, ds = ags.datastore;
  const portalUp = portal ? portal.machines.filter((m) => m.ready).length : 0;
  const dsUp = ds ? ds.machines.filter((m) => m.up).length : 0;
  const dsPrimary = ds && ds.machines.some((m) => m.role === "PRIMARY" && m.up);
  const pColor = !portalUp ? "var(--fail)" : portalUp < portal.machines.length || portal.indexLag ? "var(--warn)" : "var(--cyan)";
  const dColor = !dsPrimary ? "var(--fail)" : dsUp < ds.machines.length || ds.backupLocationFull ? "var(--warn)" : "var(--cyan)";
  const portalNode = feat.portal && portal
    ? `<g class="${portalUp ? "" : "pulse"}">${svgTitle("Portal", "Federated with ArcGIS Server, which is its hosting server.")}<rect x="18" y="132" width="86" height="46" rx="8" fill="#120a2a" stroke="${pColor}" stroke-width="${portalUp ? 1 : 2}"/>
       <text x="61" y="151" fill="${pColor}" font-size="11" text-anchor="middle">Portal</text>
       <text x="61" y="167" fill="var(--dim)" font-size="10" text-anchor="middle">${portalUp && portal.indexLag ? "index behind" : `${portalUp}/${portal.machines.length} ready`}</text></g>
       <line x1="104" y1="146" x2="228" y2="108" stroke="var(--dim)" stroke-dasharray="3 3"/>`
    : "";
  const dsNode = feat.datastore && ds
    ? `<g class="${dsPrimary ? "" : "pulse"}">${svgTitle("Data Store", "The hosting server's managed relational data store, where hosted feature layers live.")}<rect x="312" y="132" width="96" height="46" rx="8" fill="#120a2a" stroke="${dColor}" stroke-width="${dsPrimary ? 1 : 2}"/>
       <text x="360" y="151" fill="${dColor}" font-size="11" text-anchor="middle">Data Store</text>
       <text x="360" y="167" fill="var(--dim)" font-size="10" text-anchor="middle">${dsPrimary && ds.backupLocationFull ? "backups stopped" : `${dsUp}/${ds.machines.length} up`}</text></g>
       <line x1="345" y1="124" x2="352" y2="130" stroke="var(--dim)" marker-end="url(#arr)"/>`
    : "";
  const wgs = ags.webgisdr;
  const wgLast = wgs && wgs.backups.length ? wgs.backups[wgs.backups.length - 1] : null;
  const wgAge = wgLast ? s.tick - wgLast.tick : null;
  const wgFailed = wgs && wgs.runs.length && wgs.runs[wgs.runs.length - 1].status !== "success";
  const wgColor = !wgLast || wgAge > 72 ? "var(--fail)" : wgAge > 24 || wgFailed ? "var(--warn)" : "var(--ok)";
  const wgLine = feat.backups && wgs
    ? `<g>${svgTitle("webgisdr", "Age of the newest .webgissite backup of the whole site.")}<text x="398" y="310" fill="${wgColor}" font-size="10" text-anchor="end">site backup ${wgLast ? `${wgAge}h ago` : "none"}${wgFailed ? ", last run failed" : ""}</text></g>`
    : "";
  const slots = s.db.slots.map((x, i) =>
    `<g>${svgTitle("replication slot")}<line x1="290" y1="${215 + i * 10}" x2="400" y2="${190 + i * 10}" stroke="var(--warn)" stroke-width="2" stroke-dasharray="2 4"/>
     <text x="402" y="${192 + i * 10}" fill="var(--warn)" font-size="9" text-anchor="end">${esc(x.name)}</text></g>`).join("");
  $("netmap").innerHTML = `
    <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--dim)"/></marker></defs>
    <rect x="10" y="10" width="400" height="310" rx="14" fill="none" stroke="var(--line)" stroke-dasharray="6 4"/>
    <text x="22" y="30" fill="var(--dim)" font-size="10">VPC  egdb-lab  us-east-1</text>
    <g>${svgTitle("VPC", "Traffic from the internet reaches the database only if the instance is publicly accessible.")}<ellipse cx="70" cy="80" rx="48" ry="26" fill="#120a2a" stroke="var(--dim)"/><text x="70" y="84" fill="var(--ink)" font-size="11" text-anchor="middle">internet</text></g>
    <g>${svgTitle("security group")}<path d="M160 58 l24 8 v18 c0 14 -12 22 -24 26 c-12 -4 -24 -12 -24 -26 v-18 z" fill="#120a2a" stroke="${shield}" stroke-width="2"/>
       <text x="160" y="122" fill="${shield}" font-size="10" text-anchor="middle">${inst.public ? "PUBLIC" : "private"}</text></g>
    <line x1="118" y1="80" x2="134" y2="80" stroke="var(--dim)" marker-end="url(#arr)"/>
    <g>${svgTitle("ArcGIS Server")}<rect x="230" y="44" width="150" height="78" rx="8" fill="#120a2a" stroke="${agsColor}" stroke-width="${agsUp ? 1 : 2}"/>
       <text x="305" y="64" fill="${agsColor}" font-size="11" text-anchor="middle">ArcGIS Server ${esc(ags.version)}</text>
       <text x="305" y="80" fill="${machinesUp === ags.machines.length ? "var(--dim)" : "var(--fail)"}" font-size="10" text-anchor="middle">${machinesUp}/${ags.machines.length} machine${ags.machines.length > 1 ? "s" : ""} up${ags.licensed ? "" : "  UNLICENSED"}</text>
       <text x="305" y="95" fill="${ags.cert.trusted ? "var(--ok)" : "var(--warn)"}" font-size="10" text-anchor="middle">${ags.cert.trusted ? "trusted TLS" : "self-signed TLS"}</text>
       <text x="305" y="110" fill="${svcDown ? "var(--fail)" : storm || svcHot ? "var(--warn)" : "var(--dim)"}" font-size="10" text-anchor="middle">${svcUp}/${svcs.length} services${svcHot ? ", pool maxed" : storm ? ", LOAD SPIKE" : ""}</text></g>
    <line x1="186" y1="80" x2="228" y2="80" stroke="var(--dim)" marker-end="url(#arr)"/>
    <line x1="305" y1="124" x2="230" y2="168" stroke="var(--dim)" marker-end="url(#arr)"/>
    <g class="${down ? "pulse" : ""}">${svgTitle("Amazon RDS", "This instance holds the enterprise geodatabase.")}<rect x="110" y="170" width="180" height="78" rx="10" fill="#120a2a" stroke="${color}" stroke-width="2"/>
       <text x="200" y="194" fill="${color}" font-size="12" text-anchor="middle">${esc(inst.identifier)}</text>
       <text x="200" y="211" fill="var(--ink)" font-size="10" text-anchor="middle">PostgreSQL ${esc(inst.engineVersion)} / PostGIS ${esc(inst.postgis)}</text>
       <text x="200" y="226" fill="var(--dim)" font-size="10" text-anchor="middle">${esc(inst.cls)} ${inst.multiAz ? "Multi-AZ" : "single-AZ"}</text>
       <text x="200" y="240" fill="${color}" font-size="10" text-anchor="middle">${esc(inst.status)}</text></g>
    ${standby}${slots}${portalNode}${dsNode}${wgLine}
    <text x="22" y="310" fill="var(--dim)" font-size="10">RDS backups ${inst.backupRetention}d  ${inst.deletionProtection ? "delete-protected" : "deletable"}  ${inst.iamAuth ? "IAM auth" : "password auth"}</text>`;

  const used = Math.max(0, inst.allocatedGb * GIB - freeBytes(s));
  const storePct = Math.min(100, (100 * used) / (inst.allocatedGb * GIB));
  const g = $("g-store");
  g.style.width = `${storePct}%`;
  g.style.background = storePct > 95 ? "var(--fail)" : storePct > 85 ? "var(--warn)" : "var(--ok)";
  $("g-store-t").textContent = `${(used / GIB).toFixed(1)} / ${inst.allocatedGb} GB`;
  const conns = s.db.sessions.length, max = maxConnections(s) - s.db.reserved;
  const cPct = Math.min(100, (100 * conns) / max);
  const c = $("g-conn");
  c.style.width = `${cPct}%`;
  c.style.background = cPct >= 95 ? "var(--fail)" : cPct >= 80 ? "var(--warn)" : "var(--ok)";
  $("g-conn-t").textContent = `${conns} / ${max}`;
  const act = s.scenarios.active.map((a) => a.id.replace(/_/g, " "));
  $("status-line").textContent = down
    ? `Instance ${inst.status}. Health and maintenance scans cannot connect.`
    : !agsUp ? "ArcGIS Server is down: no maps are being served."
    : feat.datastore && !dsPrimary ? "ArcGIS Data Store is down: hosted feature layers are failing."
    : feat.portal && !portalUp ? "Portal is down: nobody can sign in or open web maps."
    : act.length ? `Ongoing: ${act.join(", ")}` : "All quiet.";
}

function renderFindings(game, handlers) {
  const s = game.s;
  const list = [...game.findings].filter((f) => f.code !== "FLT001").sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.code.localeCompare(b.code));
  $("find-summary").textContent = game.summary();
  const pend = $("pending");
  if (s.pending) {
    pend.classList.remove("hidden");
    pend.textContent = `Working: ${s.pending.label} (done at hour ${s.pending.completeAt})`;
  } else pend.classList.add("hidden");

  const ul = $("findings");
  ul.innerHTML = "";
  list.forEach((f, i) => {
    const key = `${f.code}|${f.title}`;
    const li = document.createElement("li");
    li.className = `finding ${f.severity}${openKey === key ? " open" : ""}`;
    const acts = actionsFor(f, s);
    li.innerHTML = `
      <div class="top"><span class="sev ${f.severity}" data-sev="${f.severity}">${f.severity}</span><span class="code" data-code="${esc(f.code)}">${esc(f.code)}</span>${CLIENT_SOURCES.has(f.source) ? `<span class="client-tag" data-term="Northwind Survey Agency">client</span>` : ""}<span>${rich(f.title)}</span></div>
      <div class="detail">
        ${f.detail ? `<div>${rich(f.detail).replace(/\n/g, "<br>")}</div>` : ""}
        <div class="small dim">source: ${EGISOPS_SOURCES.has(f.source) ? "egisops" : "rdsops"} ${esc(f.source)}</div>
        ${f.severity !== "OK" && acts.length ? `<div class="act">${acts.map((a, j) => `
          <button class="btn" data-f="${i}" data-a="${a.id}" ${game.busy() ? "disabled" : ""}>${rich(a.label)}${a.hours ? ` <span class="dim">(${a.hours}h)</span>` : ""}</button>
          <code class="cmd">${esc(a.command(f, s))}</code>`).join("")}</div>` : ""}
      </div>`;
    li.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]");
      if (b) {
        e.stopPropagation();
        handlers.act(list[Number(b.dataset.f)], b.dataset.a);
        return;
      }
      openKey = openKey === key ? null : key;
      renderFindings(game, handlers);
    });
    ul.appendChild(li);
  });
  $("btn-scan").disabled = false;
}

function renderFleet(game, handlers) {
  const s = game.s;
  const on = Boolean(s.fleet && s.fleet.started != null);
  $("fleet-h").classList.toggle("hidden", !on);
  const box = $("fleet");
  box.classList.toggle("hidden", !on);
  if (!on) return;
  const rows = new Map(game.findings.filter((f) => f.code === "FLT001").map((f) => [f.evidence.instance, f]));
  const total = game.findings.find((f) => f.code === "FLT000");
  const line = (id, owner, region, m) => {
    const f = rows.get(id);
    const sev = f ? f.severity : "INFO";
    const fixes = m ? Object.entries(FIXES).filter(([, x]) => x.when(m)) : [];
    return `<li class="fleet-row">
      <div><span class="mini-sev ${sev}" data-sev="${sev}">${sev}</span> <b>${esc(id)}</b> <span class="dim small">${esc(owner)}, ${esc(region)}</span></div>
      ${f && f.detail ? `<div class="small dim">${rich(f.detail)}</div>` : ""}
      ${m && m.work ? `<div class="small">Working: ${rich(FIXES[m.work.id].label)}, ${m.work.until - s.tick}h left</div>` : ""}
      ${m && !m.work && fixes.length ? `<div class="row wrap">${fixes.map(([fid, x]) => `<button class="btn tiny" data-fm="${esc(m.id)}" data-fx="${fid}" title="${esc(x.command(m))}">${esc(x.label)}${x.hours ? ` (${x.hours}h)` : ""}</button>`).join("")}</div>` : ""}
    </li>`;
  };
  box.innerHTML = `${total ? `<div class="small">${rich(total.title)}</div>` : ""}
    <div class="small dim">Each site pays while under contract; failing sites cost you. Scored by rdsops fleet.</div>
    <ul class="fleet-list">
      ${line(s.instance.identifier, "Your operations center", "us-east-1", null)}
      ${s.fleet.members.map((m) => line(m.id, m.owner, m.region, m)).join("")}
    </ul>
    ${s.fleet.arrived < 6 ? `<div class="small dim">Next site arrives in about ${Math.max(0, s.fleet.nextArrival - s.tick)} hours.</div>` : ""}`;
  box.querySelectorAll("[data-fm]").forEach((b) => b.addEventListener("click", () => handlers.fleet(b.dataset.fm, b.dataset.fx)));
}

function renderSide(game, handlers) {
  const s = game.s;
  renderCampaign(game, handlers);
  renderFleet(game, handlers);
  $("quests").innerHTML = activeQuests(s).slice(0, 4).map((q) => `<li><b>${esc(q.title)}</b><br><span class="small dim">${rich(q.goal)}</span></li>`).join("")
    || `<li class="dim small">All current quests done. More arrive with levels.</li>`;

  const shopOn = features(s.level).shop;
  $("shop-h").classList.toggle("hidden", !shopOn);
  $("shop").classList.toggle("hidden", !shopOn);
  if (shopOn) {
    $("shop").innerHTML = UPGRADES.filter((u) => s.level >= u.minLevel).map((u) => u.has(s)
      ? `<li><span>${rich(u.label)}</span><span class="owned">owned</span></li>`
      : `<li><span>${rich(u.label)}</span><button class="btn tiny" data-up="${u.id}" ${game.busy() ? "disabled" : ""}>Do it</button></li>`).join("");
    $("shop").querySelectorAll("button[data-up]").forEach((b) => b.addEventListener("click", () => handlers.upgrade(b.dataset.up)));
  }

  renderOps(game, handlers);

  const got = new Set(s.achievements);
  const shown = ACHIEVEMENTS.filter((a) => !a.hidden || got.has(a.id));
  $("ach-count").textContent = `${got.size}/${ACHIEVEMENTS.length}`;
  $("achievements").innerHTML = shown.map((a) => `<li class="badge ${got.has(a.id) ? "got" : ""}" title="${esc(a.title)}: ${esc(a.desc)}">${esc(a.title.split(" ").map((w) => w[0]).join("").slice(0, 2))}</li>`).join("")
    + (got.size < ACHIEVEMENTS.length ? `<li class="badge" title="Hidden achievements remain">?</li>` : "");
}

function renderTakeover(game, handlers, box) {
  const s = game.s;
  const t = s.takeover;
  const x = t.client;
  const cl = x.cluster;
  const free = TK.freeGb(x.source, cl);
  const steps = Object.entries(TK.STEPS).filter(([, st]) => st.chapter === t.chapter);
  box.innerHTML = t.finished
    ? `<div class="camp-title">The Takeover <span class="mini-sev OK">DONE</span></div><div class="small dim">${esc(x.name)} runs on Aurora and is in your fleet. Writes were stopped for ${t.clientDownHours} hour(s).</div>`
    : `<div class="camp-title">The Takeover</div>
    <div class="small">Client: <b>${esc(x.name)}</b>, ${esc(x.region)} (GovCloud)</div>
    <div class="small">Chapter ${t.chapter} of ${TK.CHAPTERS.length}: <b>${esc(TK.CHAPTERS[t.chapter - 1].title)}</b></div>
    <div class="small dim">${rich(TK.CHAPTERS[t.chapter - 1].goal)}</div>
    <div class="versions">
      <span class="${x.source.retired ? "old" : ""}">RDS ${esc(x.source.engineVersion)}${x.source.retired ? " (retired)" : ""}</span>
      <span class="${cl ? "ok" : "old"}">Aurora ${cl ? `${esc(cl.version)} ${esc(cl.state)}` : "none"}</span>
      <span class="${free / x.source.allocatedGb < 0.2 ? "old" : "ok"}">free ${Math.max(0, Math.round(free))} of ${x.source.allocatedGb} GB</span>
      ${cl && cl.state !== "promoted" ? `<span>lag ${cl.lagGb} GB, WAL ${cl.walGb} GB</span>` : ""}
      <span class="${x.writes ? "ok" : "old"}">writes ${x.writes ? "on" : "STOPPED"}</span>
    </div>
    <div class="small dim">Aurora in ${esc(x.region)}: ${x.regionAurora.map(esc).join(", ")}</div>
    ${t.work ? `<div class="alert">${rich(TK.STEPS[t.work.id].label)}: ${t.work.until - s.tick} hour(s) left.</div>` : ""}
    <div class="col">${steps.map(([id, st]) => {
      const why = TK.available(s, id);
      const done = Boolean(why && /already|No abandoned|A reader exists|Already done|Services are running/.test(why));
      return `<button class="btn tiny${done ? " done" : ""}" data-tk="${id}" title="${esc(why || st.command)}" ${t.work || done ? "disabled" : ""}>${done ? "Done: " : ""}${esc(st.label)}${done || !st.hours ? "" : ` (${st.hours}h)`}</button>`;
    }).join("")}</div>`;
  box.querySelectorAll("[data-tk]").forEach((b) => b.addEventListener("click", () => handlers.takeover(b.dataset.tk)));
}

function renderCampaign(game, handlers) {
  const s = game.s;
  if (s.takeover && s.takeover.started != null) {
    $("camp-h").classList.remove("hidden");
    $("camp").classList.remove("hidden");
    renderTakeover(game, handlers, $("camp"));
    return;
  }
  const c = s.campaign;
  const on = Boolean(c && c.started != null);
  $("camp-h").classList.toggle("hidden", !on);
  const box = $("camp");
  box.classList.toggle("hidden", !on);
  if (!on) return;
  const a = s.arcgis;
  const ver = (v) => (v || "").split(".").slice(0, 2).join(".");
  const comps = [["Portal", a.portal.version], ["Server", a.version], ["Data Store", a.datastore.release], ["Pro", a.proVersion]];
  const steps = Object.entries(STEPS).filter(([, x]) => x.chapter === c.chapter || (c.chapter === 3 && x.chapter === 3));
  const working = c.work ? `<div class="alert">${rich(STEPS[c.work.id].label)}: ${c.work.until - s.tick} hour(s) left.</div>` : "";
  box.innerHTML = c.finished
    ? `<div class="camp-title">The 12.1 Upgrade <span class="mini-sev OK">DONE</span></div><div class="small dim">Every component on 12.1, on a supported database.</div>`
    : `<div class="camp-title">The 12.1 Upgrade</div>
    <div class="small">Chapter ${c.chapter} of ${CHAPTERS.length}: <b>${esc(CHAPTERS[c.chapter - 1].title)}</b></div>
    <div class="small dim">${rich(CHAPTERS[c.chapter - 1].goal)}</div>
    <div class="versions">${comps.map(([n, v]) => `<span class="${ver(v) === "12.1" || v === "3.7" ? "ok" : "old"}">${esc(n)} ${esc(ver(v))}</span>`).join("")}</div>
    ${c.chapter === 1 ? `<div class="small">Web AppBuilder apps left: ${a.portal.wabApps}. Fresh backup: ${backupFresh(s) ? "yes" : "no"}</div>` : ""}
    ${working}
    <div class="col">${steps.map(([id, x]) => {
      const why = available(s, id);
      const done = Boolean(why && / already |No Web AppBuilder apps are left/.test(why));
      return `<button class="btn tiny${done ? " done" : ""}" data-camp="${id}" title="${esc(why || x.command)}" ${c.work || done ? "disabled" : ""}>${done ? "Done: " : ""}${esc(x.label)}${done ? "" : ` (${x.hours}h)`}</button>`;
    }).join("")}</div>`;
  box.querySelectorAll("[data-camp]").forEach((b) => b.addEventListener("click", () => handlers.campaign(b.dataset.camp)));
}

function renderOps(game, handlers) {
  const s = game.s;
  const f = features(s.level);
  $("ops-h").classList.toggle("hidden", !f.drills);
  const box = $("ops");
  box.classList.toggle("hidden", !f.drills);
  if (!f.drills) return;
  const busy = game.busy() ? "disabled" : "";
  const lost = (s.db.lost || []).map((x) => `${x.table.schema}.${x.table.table}`);
  const last = s.drills && s.drills.last;
  const { day, hour } = clock(s.tick);
  const auditLeft = s.auditDue ? s.auditDue - s.tick : null;
  box.innerHTML = `
    ${lost.map((n) => `<div class="alert">${esc(n)} was dropped. <button class="btn tiny" data-recover="${esc(n)}" ${busy}>Point-in-time restore</button></div>`).join("")}
    ${auditLeft != null ? `<div class="alert audit">Audit: prove a restore within ${auditLeft} game hours.</div>` : ""}
    <div class="row">
      <button class="btn tiny" data-drill="pitr" ${busy}>Run restore drill</button>
      ${f.snapshotDrills ? `<button class="btn tiny" data-drill="snapshot" ${busy}>Snapshot drill</button>` : ""}
    </div>
    ${last ? `<div class="small dim">Last drill ${last.ran ? "" : "(plan only) "}D${Math.floor(last.tick / 24) + 1}:</div>
      <ul>${last.findings.filter((x) => x.severity !== "INFO").map((x) => `<li title="${esc(x.detail)}"><span class="mini-sev ${x.severity}" data-sev="${x.severity}">${x.severity}</span><span data-code="${esc(x.code)}">${esc(x.code)}</span> ${rich(x.title)}</li>`).join("")}</ul>` : `<div class="small dim">No drills yet. It is D${day} ${String(hour).padStart(2, "0")}:00; do you know your backups work?</div>`}`;
  box.querySelectorAll("[data-drill]").forEach((b) => b.addEventListener("click", () => handlers.drill(b.dataset.drill)));
  box.querySelectorAll("[data-recover]").forEach((b) => b.addEventListener("click", () => handlers.recover(b.dataset.recover)));
}

export function appendLog(line) {
  const ol = $("log");
  const li = document.createElement("li");
  li.className = line.kind || "";
  const body = line.kind === "action" ? esc(line.text) : rich(line.text);
  li.innerHTML = `<span class="stamp">${esc(line.stamp)}</span>${body}`;
  ol.appendChild(li);
  while (ol.children.length > 300) ol.removeChild(ol.firstChild);
  ol.scrollTop = ol.scrollHeight;
}

export function toast(title, body) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
  const box = $("toasts");
  box.appendChild(t);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => t.remove(), 5000);
}

// ---------------------------------------------------------------- modals
export function modal({ title, html, actions = [] }) {
  return new Promise((resolve) => {
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = html;
    const bar = $("modal-actions");
    bar.innerHTML = "";
    for (const a of actions) {
      if (a.html) { const d = document.createElement("div"); d.className = "dots"; d.innerHTML = a.html; bar.appendChild(d); continue; }
      const b = document.createElement("button");
      b.className = `btn ${a.primary ? "primary" : ""}`;
      b.textContent = a.label;
      b.addEventListener("click", () => { $("modal").classList.add("hidden"); resolve(a.value); });
      bar.appendChild(b);
    }
    $("modal").classList.remove("hidden");
    const first = bar.querySelector("button.primary") || bar.querySelector("button");
    if (first) first.focus();
  });
}

export async function showTutorial(id) {
  const t = TUTORIALS[id];
  if (!t) return;
  for (let i = 0; i < t.cards.length; i++) {
    const c = t.cards[i];
    const links = c.links.length ? `<h4>Read more</h4><ul class="links">${c.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join("")}</ul>` : "";
    const dots = t.cards.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("");
    const last = i === t.cards.length - 1;
    const go = await modal({
      title: t.title,
      html: `<h4>${esc(c.heading)}</h4><p>${rich(c.body)}</p>${links}`,
      actions: [{ html: dots }, ...(i > 0 ? [{ label: "Back", value: "back" }] : []), { label: last ? "Got it" : "Next", value: "next", primary: true }],
    });
    if (go === "back") i -= 2;
  }
}

export function careerHtml(s) {
  const cells = LEVELS.map((l) => `<div class="${l.n < s.level ? "done" : l.n === s.level ? "now" : ""} ${l.playable ? "" : "planned"}" title="${l.n}. ${esc(l.title)} (${esc(l.tierName)})">${l.n}</div>`).join("");
  const tiers = TIERS.map((t) => `<li><b>Tier ${t.tier}: ${esc(t.name)}</b> <span class="dim">${rich(t.subject)}. ${t.status === "playable" ? "Playable now." : "Planned."} Real tool: ${esc(t.tool)}.</span></li>`).join("");
  return `<p>100 levels in ten tiers. Each tier is backed by a real administration tool; tiers open as those tools are built.</p>
    <div class="career">${cells}</div><ul>${tiers}</ul>`;
}

export function glossaryHtml() {
  const items = [...TERMS].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
  return `<div class="glossary">
    <input class="glossary-search" id="glossary-q" placeholder="Search ${items.length} terms" aria-label="Search the glossary">
    <dl id="glossary-list">${items.map((t) => `<div data-g="${esc((t.term + " " + (t.also || []).join(" ")).toLowerCase())}"><dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd></div>`).join("")}</dl>
  </div>`;
}

export function wireGlossarySearch() {
  const q = document.getElementById("glossary-q");
  if (!q) return;
  q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    document.querySelectorAll("#glossary-list > div").forEach((d) => {
      d.hidden = Boolean(v) && !d.dataset.g.includes(v) && !d.textContent.toLowerCase().includes(v);
    });
  });
  q.focus();
}
