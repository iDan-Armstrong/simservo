import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, TIERS, levelForXp, xpForLevel } from "../site/js/levels.js";

test("there are 100 levels in 10 tiers with unique titles", () => {
  assert.equal(LEVELS.length, 100);
  assert.equal(TIERS.length, 10);
  assert.equal(new Set(LEVELS.map((l) => l.title)).size, 100);
  for (const l of LEVELS) assert.equal(l.tier, Math.ceil(l.n / 10));
});

test("xp thresholds rise and levelForXp inverts them", () => {
  for (let n = 2; n <= 100; n++) assert.ok(xpForLevel(n) > xpForLevel(n - 1));
  for (const n of [1, 2, 10, 55, 100]) assert.equal(levelForXp(xpForLevel(n)), n);
  assert.equal(levelForXp(xpForLevel(10) - 1), 9);
});

test("tiers with a real tool are playable and every unlock has a tutorial", () => {
  const playable = new Set(TIERS.filter((t) => t.status === "playable").map((t) => t.tier));
  // every tier has its real tool now
  assert.deepEqual([...playable], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const l of LEVELS) assert.equal(l.playable, playable.has(l.tier), `level ${l.n}`);
  for (const l of LEVELS) if (l.unlocks.length && l.n > 1) assert.ok(l.tutorial, `level ${l.n}`);
});
