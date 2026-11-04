# 0001. Run the real rules in the browser

Status: accepted (2026-11-04)

## Context

SIMServo exists to teach real administration. If the game had its own copy of the
thresholds and finding text, the two would drift: the game would teach yesterday's
rules, and nobody would notice until a player trusted it.

Two ways to share the rules with a JavaScript game:

1. Port the evaluators to JavaScript and keep them honest with golden fixtures
   exported from the Python tool.
2. Run the Python evaluators themselves in the browser with Pyodide.

## Decision

Option 2. rdsops evaluators are pure functions over snapshots
(rdsops ADR 0006), so they load in Pyodide with only the standard library. The game
pins an rdsops commit in `RDSOPS_REF`, builds that wheel in CI, and serves it with a
self-hosted Pyodide.

Pyodide is about 12 MB. That cost is turned into part of the experience: a
configuration wizard that plays as a controller setup and shows the real download.

## Consequences

- One source of truth. A change to an rdsops threshold changes the game when
  `RDSOPS_REF` is bumped, and the parity test fails if a scenario stops raising the code
  it teaches.
- First load is slower than a pure JavaScript game. Later visits come from the browser
  cache.
- Building the game exercises the tool from a new angle. The first round found that
  failing inventory checks printed their passing title, which was fixed in rdsops.
