# SIMServo

![CI](https://github.com/iDan-Armstrong/simservo/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

A server administration training game where the rules are not made up. You run a small
GIS shop (an ArcGIS Server site and an Amazon RDS for PostgreSQL database holding an
enterprise geodatabase) through business days, accidents, attacks, outages, and the
occasional Trollzilla. Every warning in the game comes from
[rdsops](https://github.com/iDan-Armstrong/rds-geodatabase-ops), a real administration
tool, running inside the page through Pyodide.

**Play:** https://idan-armstrong.github.io/simservo/

## What is real and what is simulated

| Real | Simulated |
| --- | --- |
| The checks: rdsops `inventory`, `health`, `maintenance`, `compat`, at a pinned commit | The network: one VPC, one ArcGIS Server site, one RDS instance |
| Finding codes, severities, thresholds and fix text | The numbers: connections, dead rows, WAL, storage, transaction ID age |
| The commands each action shows (AWS CLI, SQL, console steps) | Time (one tick is one game hour) and money |
| Tutorial links to AWS, Esri, PostgreSQL and PostGIS docs, checked by CI | Scenarios, quests, XP and achievements |

The engine only moves numbers the way a database moves them: business hours bring
connections, edits make dead rows, autovacuum cleans them unless an open transaction
pins them, an orphaned replication slot keeps WAL until the disk fills. Each tick it
builds a snapshot in the same shape rdsops gathers from a real system and hands it to
the real evaluators. The game never decides on its own that something is wrong.

## How it loads

The page opens with a configuration wizard styled as a controller setup. The
"firmware" it downloads is real: Pyodide (CPython compiled to WebAssembly, about 12 MB)
and the rdsops wheel, both served from this site, with real byte counts on the progress
bars. The last wizard step is a live self-test: the rules engine is asked about
PostgreSQL 16.4 with PostGIS 3.5.3 on ArcGIS 12.1 and has to fail it.

## Progression

- 100 levels in ten tiers. Tier 1 (Fundamentals, levels 1 to 10) is playable now.
- Each tier is backed by a real tool. Tiers open as those tools are built: monitoring,
  upgrades, restore drills, then ArcGIS Server, Portal and Data Store administration.
- An intro tutorial, and a tutorial at each level that adds something, with links to
  the real documentation.
- Quests, achievements (some hidden), a budget that pays the AWS bill every hour, and
  uptime that costs you when it slips.

## Run it locally

```bash
npm ci                 # Pyodide, self-hosted
npm run rdsops         # builds the rdsops wheel at the commit in RDSOPS_REF
npm run build          # copies both into site/vendor
npm run serve          # http://localhost:8080
```

URL options: `?seed=42` for a repeatable game, `?speed=0` to start paused,
`?skipintro`, `?new` to ignore a save, and `?trollzilla` if you cannot wait.

## How it is tested

| Test | What it proves |
| --- | --- |
| `npm test` | 100 levels, tutorials and links well formed; engine determinism; open transactions pin dead rows; orphaned slots fill the disk; XP is awarded once per fix |
| `tests/test_bridge.py` | Every finding code the game uses exists in rdsops, and every scenario raises the code it claims to teach when its snapshot runs through the real evaluators |
| `tests/e2e/smoke.mjs` | The built site in Chromium: wizard loads real Pyodide and rdsops, self-test passes, a finding is fixed through the UI, 48 game hours play, Trollzilla takes the region down |
| `tools/check-links.mjs` | Every tutorial link answers |

## Architecture decisions

- [ADR 0001: Run the real rules in the browser](docs/adr/0001-run-the-real-rules-in-the-browser.md)
- rdsops [ADR 0006](https://github.com/iDan-Armstrong/rds-geodatabase-ops/blob/main/docs/adr/0006-checks-are-pure-functions-over-snapshots.md):
  checks are pure functions over snapshots, which is what makes this game possible.

## Credits

Trollzilla is an original creature. Pyodide is MPL-2.0. SIMServo is MIT.
