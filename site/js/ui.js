// Rendering. Reads game state, writes DOM. No game rules here.

import { GIB, clock, freeBytes, isDown, maxConnections, monthlyCost } from "./engine.js";
import { actionsFor, UPGRADES } from "./actions.js";
import { LEVELS, TIERS, features, xpForLevel } from "./levels.js";
import { ACHIEVEMENTS, activeQuests, uptimePct } from "./progression.js";
import { TUTORIALS } from "./tutorials.js";

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    ? `<g><rect x="300" y="250" width="100" height="56" rx="8" fill="#120a2a" stroke="var(--cyan)" stroke-dasharray="4 3"/>
       <text x="350" y="274" fill="var(--cyan)" font-size="11" text-anchor="middle">standby</text>
       <text x="350" y="290" fill="var(--dim)" font-size="10" text-anchor="middle">us-east-1b</text>
       <line x1="300" y1="240" x2="330" y2="250" stroke="var(--cyan)" stroke-dasharray="3 3"/></g>`
    : "";
  const slots = s.db.slots.map((x, i) =>
    `<g><line x1="290" y1="${215 + i * 10}" x2="400" y2="${190 + i * 10}" stroke="var(--warn)" stroke-width="2" stroke-dasharray="2 4"/>
     <text x="402" y="${192 + i * 10}" fill="var(--warn)" font-size="9" text-anchor="end">${esc(x.name)}</text></g>`).join("");
  $("netmap").innerHTML = `
    <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--dim)"/></marker></defs>
    <rect x="10" y="10" width="400" height="310" rx="14" fill="none" stroke="var(--line)" stroke-dasharray="6 4"/>
    <text x="22" y="30" fill="var(--dim)" font-size="10">VPC  egdb-lab  us-east-1</text>
    <g><ellipse cx="70" cy="80" rx="48" ry="26" fill="#120a2a" stroke="var(--dim)"/><text x="70" y="84" fill="var(--ink)" font-size="11" text-anchor="middle">internet</text></g>
    <g><path d="M160 58 l24 8 v18 c0 14 -12 22 -24 26 c-12 -4 -24 -12 -24 -26 v-18 z" fill="#120a2a" stroke="${shield}" stroke-width="2"/>
       <text x="160" y="122" fill="${shield}" font-size="10" text-anchor="middle">${inst.public ? "PUBLIC" : "private"}</text></g>
    <line x1="118" y1="80" x2="134" y2="80" stroke="var(--dim)" marker-end="url(#arr)"/>
    <g><rect x="230" y="44" width="150" height="78" rx="8" fill="#120a2a" stroke="${agsColor}" stroke-width="${agsUp ? 1 : 2}"/>
       <text x="305" y="64" fill="${agsColor}" font-size="11" text-anchor="middle">ArcGIS Server ${esc(ags.version)}</text>
       <text x="305" y="80" fill="${machinesUp === ags.machines.length ? "var(--dim)" : "var(--fail)"}" font-size="10" text-anchor="middle">${machinesUp}/${ags.machines.length} machine${ags.machines.length > 1 ? "s" : ""} up${ags.licensed ? "" : "  UNLICENSED"}</text>
       <text x="305" y="95" fill="${ags.cert.trusted ? "var(--ok)" : "var(--warn)"}" font-size="10" text-anchor="middle">${ags.cert.trusted ? "trusted TLS" : "self-signed TLS"}</text>
       <text x="305" y="110" fill="${svcDown ? "var(--fail)" : storm || svcHot ? "var(--warn)" : "var(--dim)"}" font-size="10" text-anchor="middle">${svcUp}/${svcs.length} services${svcHot ? ", pool maxed" : storm ? ", LOAD SPIKE" : ""}</text></g>
    <line x1="186" y1="80" x2="228" y2="80" stroke="var(--dim)" marker-end="url(#arr)"/>
    <line x1="305" y1="124" x2="230" y2="168" stroke="var(--dim)" marker-end="url(#arr)"/>
    <g class="${down ? "pulse" : ""}"><rect x="110" y="170" width="180" height="78" rx="10" fill="#120a2a" stroke="${color}" stroke-width="2"/>
       <text x="200" y="194" fill="${color}" font-size="12" text-anchor="middle">${esc(inst.identifier)}</text>
       <text x="200" y="211" fill="var(--ink)" font-size="10" text-anchor="middle">PostgreSQL ${esc(inst.engineVersion)} / PostGIS ${esc(inst.postgis)}</text>
       <text x="200" y="226" fill="var(--dim)" font-size="10" text-anchor="middle">${esc(inst.cls)} ${inst.multiAz ? "Multi-AZ" : "single-AZ"}</text>
       <text x="200" y="240" fill="${color}" font-size="10" text-anchor="middle">${esc(inst.status)}</text></g>
    ${standby}${slots}
    <text x="22" y="310" fill="var(--dim)" font-size="10">backups ${inst.backupRetention}d  ${inst.deletionProtection ? "delete-protected" : "deletable"}  ${inst.iamAuth ? "IAM auth" : "password auth"}</text>`;

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
    : act.length ? `Ongoing: ${act.join(", ")}` : "All quiet.";
}

function renderFindings(game, handlers) {
  const s = game.s;
  const list = [...game.findings].sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.code.localeCompare(b.code));
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
      <div class="top"><span class="sev ${f.severity}">${f.severity}</span><span class="code">${esc(f.code)}</span><span>${esc(f.title)}</span></div>
      <div class="detail">
        ${f.detail ? `<div>${esc(f.detail).replace(/\n/g, "<br>")}</div>` : ""}
        <div class="small dim">source: rdsops ${esc(f.source)}</div>
        ${f.severity !== "OK" && acts.length ? `<div class="act">${acts.map((a, j) => `
          <button class="btn" data-f="${i}" data-a="${a.id}" ${game.busy() ? "disabled" : ""}>${esc(a.label)}${a.hours ? ` <span class="dim">(${a.hours}h)</span>` : ""}</button>
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

function renderSide(game, handlers) {
  const s = game.s;
  $("quests").innerHTML = activeQuests(s).slice(0, 4).map((q) => `<li><b>${esc(q.title)}</b><br><span class="small dim">${esc(q.goal)}</span></li>`).join("")
    || `<li class="dim small">All current quests done. More arrive with levels.</li>`;

  const shopOn = features(s.level).shop;
  $("shop-h").classList.toggle("hidden", !shopOn);
  $("shop").classList.toggle("hidden", !shopOn);
  if (shopOn) {
    $("shop").innerHTML = UPGRADES.filter((u) => s.level >= u.minLevel).map((u) => u.has(s)
      ? `<li><span>${esc(u.label)}</span><span class="owned">owned</span></li>`
      : `<li><span>${esc(u.label)}</span><button class="btn tiny" data-up="${u.id}" ${game.busy() ? "disabled" : ""}>Do it</button></li>`).join("");
    $("shop").querySelectorAll("button[data-up]").forEach((b) => b.addEventListener("click", () => handlers.upgrade(b.dataset.up)));
  }

  renderOps(game, handlers);

  const got = new Set(s.achievements);
  const shown = ACHIEVEMENTS.filter((a) => !a.hidden || got.has(a.id));
  $("ach-count").textContent = `${got.size}/${ACHIEVEMENTS.length}`;
  $("achievements").innerHTML = shown.map((a) => `<li class="badge ${got.has(a.id) ? "got" : ""}" title="${esc(a.title)}: ${esc(a.desc)}">${esc(a.title.split(" ").map((w) => w[0]).join("").slice(0, 2))}</li>`).join("")
    + (got.size < ACHIEVEMENTS.length ? `<li class="badge" title="Hidden achievements remain">?</li>` : "");
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
      <ul>${last.findings.filter((x) => x.severity !== "INFO").map((x) => `<li title="${esc(x.detail)}"><span class="mini-sev ${x.severity}">${x.severity}</span>${esc(x.code)} ${esc(x.title)}</li>`).join("")}</ul>` : `<div class="small dim">No drills yet. It is D${day} ${String(hour).padStart(2, "0")}:00; do you know your backups work?</div>`}`;
  box.querySelectorAll("[data-drill]").forEach((b) => b.addEventListener("click", () => handlers.drill(b.dataset.drill)));
  box.querySelectorAll("[data-recover]").forEach((b) => b.addEventListener("click", () => handlers.recover(b.dataset.recover)));
}

export function appendLog(line) {
  const ol = $("log");
  const li = document.createElement("li");
  li.className = line.kind || "";
  li.innerHTML = `<span class="stamp">${esc(line.stamp)}</span>${esc(line.text)}`;
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
      html: `<h4>${esc(c.heading)}</h4><p>${esc(c.body)}</p>${links}`,
      actions: [{ html: dots }, ...(i > 0 ? [{ label: "Back", value: "back" }] : []), { label: last ? "Got it" : "Next", value: "next", primary: true }],
    });
    if (go === "back") i -= 2;
  }
}

export function careerHtml(s) {
  const cells = LEVELS.map((l) => `<div class="${l.n < s.level ? "done" : l.n === s.level ? "now" : ""} ${l.playable ? "" : "planned"}" title="${l.n}. ${esc(l.title)} (${esc(l.tierName)})">${l.n}</div>`).join("");
  const tiers = TIERS.map((t) => `<li><b>Tier ${t.tier}: ${esc(t.name)}</b> <span class="dim">${esc(t.subject)}. ${t.status === "playable" ? "Playable now." : "Planned."} Real tool: ${esc(t.tool)}.</span></li>`).join("");
  return `<p>100 levels in ten tiers. Each tier is backed by a real administration tool; tiers open as those tools are built.</p>
    <div class="career">${cells}</div><ul>${tiers}</ul>`;
}
