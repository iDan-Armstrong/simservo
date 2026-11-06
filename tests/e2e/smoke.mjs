// End-to-end: serve the built site, run the setup wizard (real Pyodide, real rdsops),
// play a few game hours, and check the findings come from the real rules engine.
// Usage: npm run build && npm run e2e     (SHOTS=1 to save screenshots)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Playwright may be installed locally (CI) or globally (dev containers); require() finds both.
const { chromium } = createRequire(import.meta.url)("playwright");

const PORT = 8765;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", "site"], { stdio: "ignore" });
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

try {
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Resource failures are judged by URL below; font hosts may be unreachable in sandboxes.
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
  page.on("requestfailed", (r) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push(`${r.url()} ${r.failure()?.errorText}`); });

  await page.goto(`http://localhost:${PORT}/?fast&seed=42&speed=0`);
  await page.waitForSelector("#wiz-form:not(.hidden)", { timeout: 120_000 });
  const term = await page.textContent("#wiz-term");
  if (!/rdsops \d+\.\d+\.\d+ loaded/.test(term)) fail("self-test did not report the rdsops version");
  if (!term.includes("CMP003")) fail("self-test did not run compat.check");
  if (!/egisops \d+\.\d+\.\d+ loaded/.test(term)) fail("self-test did not load egisops");
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/wizard.png" });

  await page.click("#wiz-go");
  await page.waitForSelector("#game:not(.hidden)");
  // intro tutorial: click through all cards
  for (let i = 0; i < 10 && await page.isVisible("#modal:not(.hidden)"); i++) await page.click("#modal-actions .btn.primary");

  // hover help: technical terms in findings carry a glossary tooltip
  const terms = await page.$$eval("#findings .term", (els) => els.map((e) => e.dataset.term));
  if (!terms.includes("publicly accessible")) fail(`expected glossary terms in findings, got ${terms.join(",")}`);
  await page.hover("#findings .finding .term >> nth=0");
  await page.waitForSelector("#tip:not([hidden])");
  if (((await page.textContent("#tip")) || "").length < 40) fail("tooltip shows no definition");
  await page.hover("#findings .code >> nth=0");
  if (!/Inventory/.test(await page.textContent("#tip"))) fail("finding code tooltip missing");
  await page.mouse.move(5, 5);
  await page.click("#btn-glossary");
  await page.fill("#glossary-q", "WAL");
  const shown = await page.$$eval("#glossary-list > div:not([hidden]) dt", (els) => els.map((e) => e.textContent));
  if (!shown.includes("WAL")) fail(`glossary search did not find WAL: ${shown.join(",")}`);
  await page.click("#modal-actions .btn.primary");

  const codes = await page.$$eval("#findings .code", (els) => els.map((e) => e.textContent));
  if (!codes.includes("INV002")) fail(`expected INV002 (public instance) on a new game, got ${codes.join(",")}`);

  // fix it through the UI: open the finding and click its action
  await page.click("#findings .finding:has(.code:text-is('INV002'))");
  await page.click("#findings .finding.open button[data-a='close_public']");
  const after = await page.$$eval("#findings .code", (els) => els.map((e) => e.textContent));
  if (after.includes("INV002") && (await page.$$eval("#findings .finding.FAIL .code", (e) => e.map((x) => x.textContent))).includes("INV002")) fail("INV002 still failing after closing public access");

  // play 48 game hours through the real evaluator
  const state = await page.evaluate(() => {
    for (let i = 0; i < 48; i++) window.simservo.tick();
    return { tick: window.simservo.s.tick, xp: window.simservo.s.xp, quests: window.simservo.s.quests, level: window.simservo.s.level, src: [...new Set(window.simservo.findings.map((f) => f.source))] };
  });
  console.log(state);
  if (state.tick < 48) fail("game did not advance");
  if (state.xp <= 0) fail("no XP earned");
  if (!state.quests.includes("q_lock")) fail("quest q_lock not completed");
  await page.evaluate(() => { const m = document.getElementById("modal"); m.classList.add("hidden"); }); // level-up cards
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/game.png" });

  // ArcGIS Server department through the real egisops server-health
  await page.evaluate(() => { const g = window.simservo; g.s.level = 4; g.s.xp = Math.max(g.s.xp, 600); g.s.pending = null; document.querySelector("#btn-scan").click(); });
  const srv = await page.$$eval("#findings .finding", (els) => els.map((e) => e.querySelector(".code").textContent + " " + e.querySelector(".sev").textContent));
  if (!srv.includes("SRV006 WARN")) fail(`expected SRV006 WARN for the default self-signed certificate, got ${srv.join(", ")}`);
  await page.click("#findings .finding:has(.code:text-is('SRV006'))");
  await page.click("#findings .finding.open button[data-a='replace_self_signed']");
  const fixed = await page.evaluate(() => {
    window.simservo.tick(); window.simservo.tick();
    document.querySelector("#btn-scan").click();
    return { trusted: window.simservo.s.arcgis.cert.trusted, codes: window.simservo.findings.filter((f) => f.source === "server-health").map((f) => `${f.code} ${f.severity}`) };
  });
  console.log("server-health:", fixed.codes.join(", "));
  if (!fixed.trusted || fixed.codes.includes("SRV006 WARN")) fail("certificate replacement did not clear SRV006");
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/arcgis.png" });

  // Services and logs through the real egisops services / logs
  await page.evaluate(async () => {
    const g = window.simservo; g.s.level = 5; g.s.xp = Math.max(g.s.xp, 1000); g.s.pending = null;
    const { SCENARIOS } = await import("./js/scenarios.js");
    SCENARIOS.find((x) => x.id === "service_crash").start(g.s, () => {});
    g.tick();
    document.querySelector("#btn-scan").click();
  });
  const svcCodes = await page.evaluate(() => window.simservo.findings.filter((f) => ["services", "logs"].includes(f.source)).map((f) => `${f.code} ${f.severity}`));
  console.log("services/logs:", svcCodes.join(", "));
  if (!svcCodes.includes("SVC001 FAIL")) fail("crashed service did not raise SVC001 FAIL");
  if (!svcCodes.some((c) => c.startsWith("LOG002"))) fail("crash did not show up in the logs check");
  await page.click("#findings .finding:has(.code:text-is('SVC001'))");
  await page.click("#findings .finding.open button[data-a='start_service']");
  const stillDown = await page.evaluate(() => window.simservo.findings.filter((f) => f.code === "SVC001").length);
  if (stillDown) fail("starting the service did not clear SVC001");

  // Restore drill through the real rdsops drill.plan / drill.evaluate
  await page.evaluate(() => { const g = window.simservo; g.s.level = 6; g.s.xp = Math.max(g.s.xp, 1700); g.s.instance.backupRetention = 7; g.s.pending = null; document.querySelector("#btn-scan").click(); });
  await page.click("#ops [data-drill='pitr']");
  const drill = await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.simservo.tick();
    document.querySelector("#btn-scan").click();
    return window.simservo.s.drills.last;
  });
  if (!drill || !drill.ran) fail("restore drill did not run");
  else {
    const codes = drill.findings.map((f) => f.code);
    if (!codes.includes("DRL011") || !drill.findings.every((f) => f.source === "restore-drill")) fail(`drill findings not from rdsops: ${codes}`);
    console.log("drill:", drill.findings.map((f) => `${f.code} ${f.severity}`).join(", "));
  }
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/drill.png" });

  // Portal and Data Store through the real egisops portal-health / datastore
  await page.evaluate(async () => {
    const g = window.simservo; g.s.level = 10; g.s.xp = Math.max(g.s.xp, 4400); g.s.pending = null;
    const { SCENARIOS } = await import("./js/scenarios.js");
    SCENARIOS.find((x) => x.id === "datastore_down").start(g.s, () => {});
    g.tick();
    document.querySelector("#btn-scan").click();
  });
  const entCodes = await page.evaluate(() => window.simservo.findings.filter((f) => ["portal-health", "datastore"].includes(f.source)).map((f) => `${f.code} ${f.severity}`));
  console.log("portal/datastore:", entCodes.join(", "));
  if (!entCodes.includes("DST002 FAIL")) fail("stopped data store did not raise DST002 FAIL");
  if (!entCodes.includes("PTL008 FAIL")) fail("portal federation validation did not fail with the data store down");
  await page.click("#findings .finding:has(.code:text-is('DST002'))");
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/datastore.png" });
  await page.click("#findings .finding.open button[data-a='start_datastore']");
  const dsAfter = await page.evaluate(() => { const g = window.simservo; g.tick(); document.querySelector("#btn-scan").click(); return g.findings.filter((f) => ["DST002", "PTL008"].includes(f.code)).map((f) => `${f.code} ${f.severity}`); });
  if (dsAfter.some((c) => c.endsWith("FAIL"))) fail(`starting the data store did not clear the failures: ${dsAfter}`);

  // Site backups through the real egisops backup-check
  await page.evaluate(() => { const g = window.simservo; g.s.level = 11; g.s.xp = Math.max(g.s.xp, 5400); g.s.pending = null; document.querySelector("#btn-scan").click(); });
  const bak = await page.evaluate(() => window.simservo.findings.filter((f) => f.source === "backup-check").map((f) => `${f.code} ${f.severity}`));
  console.log("backup-check:", bak.join(", "));
  if (!bak.includes("BAK010 FAIL")) fail("no WebGISDR backup should be BAK010 FAIL");
  await page.click("#findings .finding:has(.code:text-is('BAK010'))");
  await page.click("#findings .finding.open button[data-a='export_now']");
  const bakAfter = await page.evaluate(() => { const g = window.simservo; g.tick(); document.querySelector("#btn-scan").click(); return g.findings.filter((f) => f.source === "backup-check" && ["BAK010", "BAK011", "BAK004"].includes(f.code)).map((f) => `${f.code} ${f.severity}`); });
  console.log("after export:", bakAfter.join(", "));
  if (!bakAfter.includes("BAK010 OK") || !bakAfter.includes("BAK011 OK") || bakAfter.some((c) => c.startsWith("BAK004"))) fail(`export did not produce a scored backup: ${bakAfter}`);
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/backups.png" });

  // Expansion: The 12.1 Upgrade, through the real stack-compat (with rdsops compat inside)
  await page.evaluate(() => { const g = window.simservo; g.s.xp = Math.max(g.s.xp, 6500); g.s.pending = null; g.progress(); document.querySelector("#btn-scan").click(); });
  await page.evaluate(() => document.getElementById("modal").classList.add("hidden"));
  const reveal = await page.evaluate(() => window.simservo.findings.filter((f) => f.source === "stack-compat").map((f) => `${f.code} ${f.severity}`));
  console.log("stack-compat:", reveal.join(", "));
  if (!reveal.includes("CMP001 FAIL")) fail("stack-compat should find PostgreSQL 17 unsupported on 11.5");
  await page.waitForSelector("#camp:not(.hidden) [data-camp='migrate_wab']");
  await page.evaluate(() => { const g = window.simservo; g.s.arcgis.portal.wabApps = 0; g.s.pending = null; });
  await page.evaluate(async () => { const { ACTIONS } = await import("./js/actions.js"); ACTIONS.BAK010[0].apply(window.simservo.s); window.simservo.tick(); document.querySelector("#btn-scan").click(); return window.simservo.s.campaign.chapter; });
  await page.evaluate(() => { for (const id of ["modal"]) document.getElementById(id).classList.add("hidden"); });
  await page.click("#camp [data-camp='upgrade_portal']");
  const mixed = await page.evaluate(() => { const g = window.simservo; for (let i = 0; i < 4; i++) g.tick(); document.querySelector("#btn-scan").click(); return g.findings.filter((f) => f.code === "STK001").map((f) => f.severity); });
  if (mixed[0] !== "FAIL") fail(`portal on 12.1 alone should fail STK001, got ${mixed}`);
  if (process.env.SHOTS) { await page.evaluate(() => document.getElementById("modal").classList.add("hidden")); await page.screenshot({ path: "test-results/expansion.png" }); }
  const done = await page.evaluate(() => {
    const g = window.simservo;
    for (const [id, h] of [["upgrade_server", 3], ["upgrade_datastore", 3], ["rollout_pro", 6]]) {
      const r = g.campaignAct(id);
      if (!r.ok) return `refused ${id}: ${r.reason}`;
      for (let i = 0; i < h; i++) g.tick();
    }
    document.querySelector("#btn-scan").click();
    return { finished: g.s.campaign.finished, stack: g.findings.filter((f) => f.source === "stack-compat").map((f) => `${f.code} ${f.severity}`) };
  });
  console.log("expansion finished:", JSON.stringify(done));
  if (!done.finished) fail("the expansion did not finish");

  // Expansion 2: The Takeover, through the real rdsops aurora-plan and compat --platform aurora
  await page.evaluate(() => { const g = window.simservo; g.s.xp = Math.max(g.s.xp, 9000); g.s.pending = null; g.progress(); document.querySelector("#btn-scan").click(); document.getElementById("modal").classList.add("hidden"); });
  const tkFound = await page.evaluate(() => window.simservo.findings.filter((f) => f.source === "aurora-plan").map((f) => `${f.code} ${f.severity}`));
  console.log("aurora-plan (as found):", tkFound.join(", "));
  for (const c of ["AUR001 FAIL", "AUR002 FAIL", "AUR003 FAIL", "AUR005 WARN"]) if (!tkFound.includes(c)) fail(`expected ${c} from the real aurora-plan`);
  await page.waitForSelector("#camp [data-tk='delete_try']");
  await page.click("#camp [data-tk='delete_try']");
  const tk = await page.evaluate(async () => {
    const g = window.simservo;
    const step = (id, h) => { const r = g.takeoverAct(id); if (!r.ok) throw new Error(`${id}: ${r.reason}`); for (let i = 0; i < h; i++) g.tick(); };
    for (let i = 0; i < 1; i++) g.tick();
    step("grow_storage", 1); step("kms_key", 1);
    const before = g.s.takeover.chapter;
    for (let i = 0; i < 72; i++) g.tick();
    document.querySelector("#btn-scan").click();
    const after = g.s.takeover.chapter;
    step("create_cluster", 8);
    const ch3 = g.s.takeover.chapter;
    step("stop_writes", 0); step("promote", 1); step("repoint", 1); step("start_writes", 0); step("add_reader", 1);
    document.querySelector("#btn-scan").click();
    return { before, after, ch3, finished: g.s.takeover.finished, compat: g.findings.filter((f) => f.source === "client-compat").map((f) => `${f.code} ${f.severity}`) };
  });
  console.log("takeover:", JSON.stringify(tk));
  if (tk.before !== 1 || tk.after !== 2 || tk.ch3 !== 3 || !tk.finished) fail(`takeover chapters wrong: ${JSON.stringify(tk)}`);
  if (process.env.SHOTS) { await page.evaluate(() => document.getElementById("modal").classList.add("hidden")); await page.screenshot({ path: "test-results/takeover.png" }); }

  // Fleet, through the real rdsops fleet
  const fl = await page.evaluate(() => {
    const g = window.simservo;
    g.s.fleet.nextArrival = g.s.tick;
    g.tick();
    document.querySelector("#btn-scan").click();
    document.getElementById("modal").classList.add("hidden");
    return { members: g.s.fleet.members.map((m) => m.id), rows: g.findings.filter((f) => f.code === "FLT001").map((f) => `${f.evidence.instance} ${f.severity}`) };
  });
  console.log("fleet:", JSON.stringify(fl));
  if (!fl.rows.some((r) => r.startsWith("parks-egdb FAIL"))) fail("parks-egdb should fail in rdsops fleet");
  if (await page.isVisible("#troll:not(.hidden)")) await page.click("#troll-ok"); // a rare monster can show up any time
  await page.evaluate(() => document.getElementById("modal").classList.add("hidden"));
  await page.click("#fleet [data-fm='parks-egdb'][data-fx='baseline']");
  const parks = await page.evaluate(() => { const g = window.simservo; g.tick(); g.tick(); document.querySelector("#btn-scan").click(); return g.findings.find((f) => f.code === "FLT001" && f.evidence.instance === "parks-egdb"); });
  console.log("parks after baseline:", parks.severity, parks.evidence.codes.join(","));
  if (parks.evidence.codes.includes("INV002")) fail("baseline did not close public access on parks-egdb");
  if (process.env.SHOTS) { await page.evaluate(() => document.getElementById("modal").classList.add("hidden")); await page.screenshot({ path: "test-results/fleet.png" }); }

  // Security Operations: posture through the real rdsops security and egisops security,
  // then a federal incident with the real playbook, played through the console.
  const sec = await page.evaluate(() => {
    const g = window.simservo;
    if (g.s.level < 15) { g.s.xp = Math.max(g.s.xp, 14000); g.progress(); }
    document.querySelector("#btn-scan").click();
    document.getElementById("modal").classList.add("hidden");
    const f = g.findings.filter((x) => x.source === "security" || x.source === "arcgis-security");
    const inc = g.openIncident({ open: "credentials", federal: true });
    document.querySelector("#btn-scan").click(); // renders, like a game frame would
    return { level: g.s.level, fails: f.filter((x) => x.severity === "FAIL").map((x) => x.code), steps: inc.steps.length, cisa: inc.steps[2].title };
  });
  console.log("security:", JSON.stringify(sec));
  if (!sec.fails.includes("SEC001") || !sec.fails.includes("ESC003")) fail("security findings missing from the real tools");
  if (!/CISA/.test(sec.cisa)) fail("federal playbook should notify CISA right after triage");
  await page.evaluate(() => document.getElementById("modal").classList.add("hidden"));
  if (await page.isVisible("#troll:not(.hidden)")) await page.click("#troll-ok");
  await page.evaluate(() => document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden")));
  await page.waitForSelector("#incident:not(.hidden)");
  for (let guard = 0; guard < 40; guard++) {
    const next = await page.evaluate(() => {
      const inc = window.simservo.s.secops.incident;
      if (!inc) return null;
      const st = inc.steps.find((x) => !x.done && (x.phase !== "Learn" || inc.steps.every((y) => y.done || y.phase === "Learn")));
      return st ? st.n : null;
    });
    if (next == null) break;
    await page.evaluate(() => document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden")));
    await page.click(`#inc-choices [data-inc='${next}']`);
    if (process.env.SHOTS && guard === 5) await page.screenshot({ path: "test-results/incident-mid.png" });
  }
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/incident.png" });
  await page.click("#inc-close");
  await page.waitForSelector("#modal:not(.hidden)");
  const closed = await page.evaluate(() => ({ c: window.simservo.s.counters, open: Boolean(window.simservo.s.secops.incident) }));
  console.log("incident closed:", JSON.stringify({ closed: closed.c.incidentsClosed, cisa: closed.c.cisaOnTime, evidence: closed.c.evidenceKept }));
  if (closed.open || closed.c.incidentsClosed !== 1 || closed.c.cisaOnTime !== 1 || closed.c.evidenceKept !== 1) fail("incident did not close cleanly");
  await page.click("#modal-actions .btn");

  // High Availability and DR: the real rdsops resilience and failover-drill, through the panel.
  const drFound = await page.evaluate(() => {
    const g = window.simservo;
    if (g.s.level < 16) { g.s.xp = Math.max(g.s.xp, 17000); g.progress(); }
    g.s.instance.backupRetention = 7;
    document.querySelector("#btn-scan").click();
    document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden"));
    return g.findings.filter((f) => f.source === "resilience").map((f) => `${f.code} ${f.severity}`);
  });
  console.log("resilience:", JSON.stringify(drFound));
  if (!drFound.some((x) => /^RES002 (WARN|FAIL)/.test(x))) fail("rdsops resilience should flag no Region copy");
  await page.evaluate(() => {
    const g = window.simservo;
    const res = g.findings.find((f) => f.code === "RES005");
    g.act(res, "dr_key");
    g.act(g.findings.find((f) => f.code === "RES002"), "backup_replication");
    for (let i = 0; i < 2; i++) g.tick();
    g.s.secops && (g.s.secops.nextAt = 1e9);
    document.querySelector("#btn-scan").click();
  });
  if (await page.isVisible("#troll:not(.hidden)")) await page.click("#troll-ok");
  await page.evaluate(() => document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden")));
  await page.click("#dr [data-drill='region']");
  const rdrill = await page.evaluate(() => {
    const g = window.simservo;
    for (let i = 0; i < 4 && g.s.pending; i++) g.tick();
    document.querySelector("#btn-scan").click();
    return { measured: g.s.dr.measured.region, last: g.s.dr.lastDrill.findings.map((f) => `${f.code} ${f.severity}`) };
  });
  console.log("region drill:", JSON.stringify(rdrill));
  if (!(rdrill.measured > 0) || !rdrill.last.includes("DRD001 OK")) fail("Region drill was not scored by rdsops failover-drill");
  await page.evaluate(() => {
    const g = window.simservo;
    g.s.instance.status = "region-lost"; g.s.instance.downUntil = g.s.tick + 18;
    document.querySelector("#btn-scan").click();
    document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden"));
  });
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/dr.png" });
  await page.click("#dr [data-drf='0']");
  const fo = await page.evaluate(() => ({ region: window.simservo.s.dr.activeRegion, drilled: window.simservo.s.counters.drilledFailovers, until: window.simservo.s.instance.downUntil - window.simservo.s.tick }));
  console.log("failover:", JSON.stringify(fo));
  if (fo.region !== "us-west-2" || fo.drilled !== 1 || fo.until > 2) fail("drilled Region failover did not go as measured");

  // Quit: confirm, saved, clock stopped, and Resume brings the game back
  await page.evaluate(() => document.querySelectorAll("#modal").forEach((m) => m.classList.add("hidden")));
  if (await page.isVisible("#troll:not(.hidden)")) await page.click("#troll-ok");
  await page.click("#btn-quit");
  await page.click("#modal-actions .btn:text-is('Keep playing')");
  if (!(await page.isVisible("#game"))) fail("Keep playing should leave the game on screen");
  await page.click("#btn-quit");
  await page.click("#modal-actions .btn:text-is('Save and quit')");
  await page.waitForSelector("#quit:not(.hidden)");
  const quit = await page.evaluate(() => {
    const before = window.simservo.s.tick;
    const saved = JSON.parse(localStorage.getItem("simservo.save.v1") || "null");
    return { before, savedTick: saved && saved.tick, summary: document.getElementById("quit-summary").textContent };
  });
  await page.waitForTimeout(300);
  const tickAfterQuit = await page.evaluate(() => window.simservo.s.tick);
  console.log("quit:", JSON.stringify(quit));
  if (quit.savedTick !== quit.before) fail("Save and quit did not save the current state");
  if (tickAfterQuit !== quit.before) fail("the clock kept running after quitting");
  if (!/level \d+/.test(quit.summary)) fail(`quit screen summary missing: ${quit.summary}`);
  await page.click("#quit-resume");
  if (!(await page.isVisible("#game")) || (await page.isVisible("#quit"))) fail("Resume shift did not return to the game");

  // Trollzilla on demand
  await page.goto(`http://localhost:${PORT}/?fast&seed=7&speed=0&trollzilla&skipintro&new`);
  await page.waitForSelector("#wiz-form:not(.hidden)", { timeout: 120_000 });
  await page.fill("#callsign", "TROLL-TEST");
  await page.click("#wiz-go");
  await page.waitForSelector("#game:not(.hidden)");
  await page.evaluate(() => { window.simservo.tick(); });
  await page.evaluate(() => { document.querySelector("#btn-scan").click(); });
  const troll = await page.evaluate(() => window.simservo.s.instance.status);
  if (troll !== "region-lost") fail(`expected region-lost after Trollzilla, got ${troll}`);
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  await browser.close();
  if (!process.exitCode) console.log("e2e OK");
} finally {
  server.kill();
}
