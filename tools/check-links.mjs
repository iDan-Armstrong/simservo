// Fails if any tutorial or resource link does not answer. Runs in CI on every push,
// because "links must be real" is only true if something keeps checking.
import { allLinks } from "../site/js/tutorials.js";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 simservo-linkcheck";
const bad = [];
for (const { url, title } of allLinks()) {
  let status = 0;
  for (let attempt = 0; attempt < 3 && !(status >= 200 && status < 400); attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA } });
      status = res.status;
    } catch (e) {
      status = -1;
    }
    if (!(status >= 200 && status < 400)) await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`${status}  ${url}`);
  if (!(status >= 200 && status < 400)) bad.push(`${status} ${url} (${title})`);
}
if (bad.length) {
  console.error(`\n${bad.length} broken link(s):\n${bad.join("\n")}`);
  process.exit(1);
}
