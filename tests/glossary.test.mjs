import { test } from "node:test";
import assert from "node:assert/strict";
import { CODES, SEVERITY, TERMS, annotate, lookup } from "../site/js/glossary.js";
import { TUTORIALS } from "../site/js/tutorials.js";
import { SCENARIOS } from "../site/js/scenarios.js";
import { ACTIONS, UPGRADES } from "../site/js/actions.js";
import { QUESTS } from "../site/js/progression.js";
import { LEVELS, TIERS } from "../site/js/levels.js";

const marked = (html) => [...html.matchAll(/data-term="([^"]+)"/g)].map((m) => m[1]);

test("definitions are short, plain and unique", () => {
  const names = new Set();
  for (const t of TERMS) {
    assert.ok(!names.has(t.term.toLowerCase()), `duplicate ${t.term}`);
    names.add(t.term.toLowerCase());
    assert.ok(t.def.length > 30 && t.def.length <= 260, `${t.term}: ${t.def.length} chars`);
    assert.ok(!t.def.includes("—") && !t.term.includes("—"));
  }
  for (const d of Object.values(CODES)) assert.ok(!d.includes("—"));
  assert.deepEqual(Object.keys(SEVERITY), ["OK", "INFO", "WARN", "FAIL"]);
});

test("annotate marks terms once, prefers the longest phrase, and respects case for acronyms", () => {
  const html = annotate("The enterprise geodatabase on Amazon RDS uses PostGIS. PostGIS again.");
  assert.deepEqual(marked(html), ["enterprise geodatabase", "Amazon RDS", "PostGIS"]);
  assert.deepEqual(marked(annotate("cache hit ratio is low, check the cache")), ["cache hit ratio"]);
  assert.deepEqual(marked(annotate("rds:egdb-lab snapshot")), ["snapshot"]); // lowercase rds is an id, not a term
  assert.deepEqual(marked(annotate("Multi-AZ standby")), ["Multi-AZ", "standby"]);
});

test("annotate never touches code or markup, and keeps escaped text escaped", () => {
  const html = annotate("Run <code>VACUUM (ANALYZE) sewer.manholes;</code> for dead rows &lt;script&gt;");
  assert.ok(html.includes("<code>VACUUM (ANALYZE) sewer.manholes;</code>"));
  assert.deepEqual(marked(html), ["dead rows"]);
  assert.ok(html.includes("&lt;script&gt;") && !html.includes("<script>"));
});

test("every finding code prefix the game can show has help", () => {
  const prefixes = new Set([...Object.keys(ACTIONS), ...SCENARIOS.flatMap((s) => s.teaches)].map((c) => c.slice(0, 3)));
  for (const p of prefixes) assert.ok(CODES[p], `no help for ${p}`);
});

test("every technical acronym in game text is in the glossary", () => {
  const text = [
    ...Object.values(TUTORIALS).filter(Boolean).flatMap((t) => [t.title, ...t.cards.flatMap((c) => [c.heading, c.body])]),
    ...SCENARIOS.flatMap((s) => [s.title, s.blurb]),
    ...Object.values(ACTIONS).flat().map((a) => a.label),
    ...UPGRADES.map((u) => u.label),
    ...QUESTS.map((q) => q.goal),
    ...LEVELS.flatMap((l) => l.unlocks),
    ...TIERS.map((t) => t.subject),
  ].join(" ");
  // Not technical, or explained by context: severities, units, time zones, places.
  const allow = new Set(["OK", "INFO", "WARN", "FAIL", "TROLLZILLA", "DROP", "TABLE", "UTC", "US", "ID", "IDs", "DDL", "GB", "MB", "STARTED", "STOPPED", "WARNING", "FINE", "DEBUG", "VERBOSE", "ALTER", "EXTENSION", "UPDATE", "DELETE", "SELECT", "PUBLIC", "UNLICENSED", "LOAD", "SPIKE", "HTTP", "PLGR", "OR", "AND", "IIS",
    // SQL keywords inside statements shown to the player
    "CREATE", "UNIQUE", "FREEZE"]);
  const acronyms = new Set([...text.matchAll(/\b[A-Z][A-Z0-9]{1,6}\b/g)].map((m) => m[0]));
  const missing = [...acronyms].filter((a) => !allow.has(a) && !lookup(a) && !CODES[a.slice(0, 3)]);
  assert.deepEqual(missing, [], `add glossary entries for: ${missing.join(", ")}`);
});
