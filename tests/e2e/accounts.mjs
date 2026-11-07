// End-to-end for the optional accounts: the real Worker under `wrangler dev`, the built site,
// and Chromium's virtual authenticator standing in for a phone or laptop passkey.
// Sign up on "device A", play and quit, then sign in on "device B" with the same synced passkey
// and get the shift back. Finally delete the account.
// Usage: npm run build && (cd worker && npm ci) && npm run e2e:accounts
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const SITE = 8766;
const API = 8787;
const ORIGIN = `http://localhost:${SITE}`;
const procs = [
  spawn("python3", ["-m", "http.server", String(SITE), "--directory", "site"], { stdio: "ignore" }),
  spawn("npx", ["wrangler", "dev", "--port", String(API), "--var", "RP_ID:localhost", "--var", `ORIGINS:${ORIGIN}`, "--persist-to", "../test-results/wrangler-state"],
    { cwd: "worker", stdio: "ignore", detached: true }),
];
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const api = (path, token, method = "GET") =>
  fetch(`http://localhost:${API}${path}`, { method, headers: { Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

async function device(browser, credential) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  if (credential) await cdp.send("WebAuthn.addCredential", { authenticatorId, credential });
  await page.goto(`${ORIGIN}/?fast&seed=7&speed=0&skipintro&api=http://localhost:${API}`);
  await page.waitForSelector("#wiz-form:not(.hidden)", { timeout: 120_000 });
  return { context, page, cdp, authenticatorId, errors };
}

const status = (page) => page.textContent("#acct-status");

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await api("/health")).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const browser = await chromium.launch();
  const callsign = `E2E-${Date.now().toString(36).toUpperCase()}`;

  // ---- device A: sign up, play, quit
  const a = await device(browser);
  if (!(await page_visible(a.page, "#acct"))) fail("account panel hidden with ?api set");
  if (!/without an account/.test(await status(a.page))) fail(`unexpected signed-out status: ${await status(a.page)}`);
  await a.page.fill("#callsign", callsign);
  await a.page.click("#acct-signup");
  await a.page.waitForFunction(() => /Signed in as/.test(document.getElementById("acct-status").textContent), null, { timeout: 15_000 });
  console.log("signed up:", await status(a.page));
  const token = await a.page.evaluate(() => JSON.parse(localStorage.getItem("simservo.session.v1")).token);
  if ((await api("/me", token)).status !== 200) fail("new session not accepted by /me");

  await a.page.click("#wiz-go");
  await a.page.waitForSelector("#game:not(.hidden)");
  await a.page.evaluate(() => { for (let i = 0; i < 30; i++) window.simservo.tick(); });
  await a.page.click("#btn-quit");
  await a.page.click("#modal-actions .btn:text-is('Save and quit')");
  await a.page.waitForSelector("#quit:not(.hidden)");
  await a.page.waitForFunction(() => /to your account/.test(document.getElementById("quit-where").textContent));
  const localA = await a.page.evaluate(() => JSON.parse(localStorage.getItem("simservo.save.v1")));
  let cloud = null;
  for (let i = 0; i < 20 && !(cloud && cloud.state && cloud.state.tick === localA.tick); i++) {
    cloud = (await (await api("/save", token)).json()).save;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log("cloud save after quit:", JSON.stringify({ tick: cloud?.state?.tick, level: cloud?.state?.level, local: localA.tick }));
  if (!cloud || cloud.state.tick !== localA.tick) fail("the quit did not push the shift to the account");

  // the passkey syncs to device B the way a phone's passkey manager would
  const { credentials } = await a.cdp.send("WebAuthn.getCredentials", { authenticatorId: a.authenticatorId });
  if (credentials.length !== 1 || !credentials[0].isResidentCredential) fail("expected one discoverable passkey");

  // ---- device B: empty browser, sign in, get the shift back
  const b = await device(browser, credentials[0]);
  if (await b.page.evaluate(() => localStorage.getItem("simservo.save.v1"))) fail("device B should start empty");
  await b.page.click("#acct-signin");
  await b.page.waitForFunction(() => /Loaded your saved shift/.test(document.getElementById("acct-status").textContent), null, { timeout: 15_000 });
  console.log("device B:", await status(b.page), "|", await b.page.textContent("#wiz-resume"));
  if ((await b.page.inputValue("#callsign")) !== callsign) fail("callsign not restored on device B");
  await b.page.click("#wiz-go");
  await b.page.waitForSelector("#game:not(.hidden)");
  const tickB = await b.page.evaluate(() => window.simservo.s.tick);
  if (tickB !== localA.tick) fail(`device B resumed at tick ${tickB}, expected ${localA.tick}`);

  // ---- a bad origin is refused before it reaches the account store
  const evil = await fetch(`http://localhost:${API}/login/options`, { method: "POST", headers: { Origin: "https://evil.example" } });
  if (evil.status !== 403) fail(`foreign origin got ${evil.status}`);

  // ---- delete the account from device A's wizard
  await a.page.goto(`${ORIGIN}/?fast&seed=7&speed=0&skipintro&api=http://localhost:${API}`);
  await a.page.waitForSelector("#acct-delete:not(.hidden)", { timeout: 120_000 });
  await a.page.click("#acct-delete");
  await a.page.click("#modal-actions .btn:text-is('Delete account')");
  await a.page.waitForFunction(() => /Account deleted/.test(document.getElementById("acct-status").textContent), null, { timeout: 15_000 });
  if ((await api("/me", token)).status !== 401) fail("deleted account's session still works");
  if (!(await a.page.evaluate(() => localStorage.getItem("simservo.save.v1")))) fail("delete account removed the local save");
  if (process.env.SHOTS) await a.page.screenshot({ path: "test-results/account-deleted.png" });
  console.log("deleted:", await status(a.page));

  for (const d of [a, b]) if (d.errors.length) fail(`page errors: ${d.errors.join(" | ")}`);
  await browser.close();
  if (!process.exitCode) console.log("accounts e2e OK");
} catch (e) {
  fail(e.stack || e.message);
} finally {
  procs[0].kill();
  try { process.kill(-procs[1].pid); } catch { /* already gone */ }
}

async function page_visible(page, sel) {
  return page.isVisible(sel);
}
