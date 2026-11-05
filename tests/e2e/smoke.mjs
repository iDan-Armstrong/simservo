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
  if (process.env.SHOTS) {
    await page.evaluate(() => { const m = document.getElementById("modal"); m.classList.add("hidden"); });
    await page.screenshot({ path: "test-results/game.png" });
  }

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
