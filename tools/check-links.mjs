// Fails if any tutorial or resource link does not answer. Runs in CI on every push,
// because "links must be real" is only true if something keeps checking.
import { allLinks } from "../site/js/tutorials.js";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 simservo-linkcheck";
const ok = (st) => st >= 200 && st < 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bad = [];
const throttled = [];
for (const { url, title } of allLinks()) {
  let status = 0;
  for (let attempt = 0; attempt < 4 && !ok(status); attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA } });
      status = res.status;
    } catch (e) {
      status = -1;
    }
    if (!ok(status)) await sleep(status === 429 ? 5000 * (attempt + 1) : 1500);
  }
  console.log(`${status}  ${url}`);
  // 429 means the server answered and is rate limiting this runner, not that the page is gone.
  if (status === 429) throttled.push(url);
  else if (!ok(status)) bad.push(`${status} ${url} (${title})`);
  if (url.includes("github.com")) await sleep(1000);
}
if (throttled.length) console.warn(`\nRate limited (not counted as broken): ${throttled.join(", ")}`);
if (bad.length) {
  console.error(`\n${bad.length} broken link(s):\n${bad.join("\n")}`);
  process.exit(1);
}
