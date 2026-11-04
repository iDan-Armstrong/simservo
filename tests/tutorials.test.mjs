import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../site/js/levels.js";
import { TUTORIALS, allLinks } from "../site/js/tutorials.js";

test("every level tutorial exists and has content", () => {
  for (const l of LEVELS) {
    if (!l.tutorial || l.n === 1) continue;
    const t = TUTORIALS[l.tutorial];
    assert.ok(t && t.cards.length, `missing tutorial ${l.tutorial}`);
    for (const c of t.cards) assert.ok(c.heading && c.body.length > 40);
  }
  assert.ok(TUTORIALS.intro.cards.length >= 3);
});

test("links are absolute and titled", () => {
  const links = allLinks();
  assert.ok(links.length >= 20);
  for (const l of links) {
    assert.match(l.url, /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i);
    assert.ok(l.title.length > 5);
  }
});

test("no em dashes in player-facing text", () => {
  const text = JSON.stringify(TUTORIALS) + JSON.stringify(LEVELS);
  assert.ok(!text.includes("\u2014"));
});
