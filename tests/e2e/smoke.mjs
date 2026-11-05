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
