# SIMServo

![CI](https://github.com/iDan-Armstrong/simservo/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

A server administration training game where the rules are not made up. You run a small
GIS shop (an ArcGIS Server site and an Amazon RDS for PostgreSQL database holding an
enterprise geodatabase) through business days, accidents, attacks, outages, and the
occasional Trollzilla. Every warning in the game comes from real administration tools,
[rdsops](https://github.com/iDan-Armstrong/rds-geodatabase-ops) for the database and
[egisops](https://github.com/iDan-Armstrong/arcgis-enterprise-ops) for ArcGIS Server,
running inside the page through Pyodide.

**Play:** https://idan-armstrong.github.io/simservo/

## What is real and what is simulated

| Real | Simulated |
| --- | --- |
| The checks: rdsops `inventory`, `health`, `maintenance`, `compat`, `restore-drill` and egisops `server-health`, `services`, `logs`, each at a pinned commit | The network: one VPC, one ArcGIS Server site, one RDS instance |
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
and the rdsops and egisops wheels, all served from this site, with real byte counts on the progress
bars. The last wizard step is a live self-test: the rules engine is asked about
PostgreSQL 16.4 with PostGIS 3.5.3 on ArcGIS 12.1 and has to fail it.

## Progression

- 100 levels in ten tiers. Tier 1 (Fundamentals), Tier 4 (Backup and Restore), Tier 5
  (ArcGIS Server), Tier 6 (Portal and Federation) and Tier 7 (Data Store) are playable
  now, because their real tools exist.
- ArcGIS Server from level 4: a site that ships with a self-signed certificate, machines
  that do not come back after patch night, and licenses that run out. The real
  `egisops server-health` scores it. From level 5, `egisops services` and `logs` watch the
  site's services (a crashed publish, a storm-day pool that maxes out) and its SEVERE log
  entries. Log codes and messages in the simulation are illustrative. Level 41 adds a
  second machine.
- Portal for ArcGIS from level 9: the real `egisops portal-health` checks the portal's
  machines, user type licenses, federation with the hosting server and the search index.
  Scenarios hang the portal, run out of Field Worker licenses, and leave the search index
  behind a content migration. A second portal machine is in the shop.
- ArcGIS Data Store from level 10: the real `egisops datastore` validates the hosting
  server's relational data store. When it stops, hosted layers fail, the ArcGIS Server logs
  fill and the portal's federation check fails too, so one outage shows up in three
  tools. With a standby machine (in the shop) the standby takes over and it is only a
  warning. A full backup share stops backups quietly until the backup age gives it away.
- Site backups from level 11: the real `egisops backup-check` reads the game's
  `webgisdr.properties`, backup folder and last-run JSON. The shop starts with no backup and
  no schedule. Scenarios disable the nightly task, fill the backup share, "fix" the doubled
  backslashes in the paths, and rotate the portal password back into plain text. Backups
  can move to S3 with an IAM role.
- Restore drills from level 6: the game simulates the restore timeline (scaled by
  database size and instance class) and the real `rdsops restore-drill` plans and scores
  it against recovery time and data-loss targets. Accidents (a dropped table) can only
  be undone with a point-in-time restore, which only works if backups were on.
- Each tier is backed by a real tool. Tiers open as those tools are built: monitoring,
  upgrades, restore drills, then ArcGIS Server, Portal and Data Store administration.
- An intro tutorial, and a tutorial at each level that adds something, with links to
  the real documentation.
- Hover help. Technical terms in findings, quests, upgrades, the ops log and tutorials
  are underlined; hover, focus or tap one for a short definition. Finding codes and
  severities explain themselves the same way, the network map nodes have titles, and the
  Glossary button lists every term with a search box.
- Quests, achievements (some hidden), a budget that pays the AWS bill every hour, and
  uptime that costs you when it slips.

## Run it locally

```bash
npm ci                 # Pyodide, self-hosted
npm run rdsops         # builds the rdsops wheel at the commit in RDSOPS_REF
npm run egisops        # builds the egisops wheel at the commit in EGISOPS_REF
npm run build          # copies both into site/vendor
npm run serve          # http://localhost:8080
```

URL options: `?seed=42` for a repeatable game, `?speed=0` to start paused,
`?skipintro`, `?new` to ignore a save, and `?trollzilla` if you cannot wait.

## How it is tested

| Test | What it proves |
| --- | --- |
| `npm test` | 100 levels, tutorials and links well formed; every acronym the game uses has a glossary entry; a stopped data store fails federation and fails over to a standby; backups stop when the share is full; WebGISDR exports fail by component, keep seven files, and only run when scheduled; engine determinism; open transactions pin dead rows; orphaned slots fill the disk; XP is awarded once per fix |
| `tests/test_bridge.py` | Every finding code the game uses exists in rdsops or egisops; every scenario raises the code it teaches through the real evaluators; with a Data Store standby, the same outage is only a warning; drills plan and score through the real `restore-drill` |
| `tests/e2e/smoke.mjs` | The built site in Chromium: wizard loads real Pyodide and rdsops, self-test passes, glossary tooltips and search work, a finding is fixed through the UI, a stopped ArcGIS Data Store is caught by egisops and fixed, a WebGISDR export is taken through the UI and scored, 48 game hours play, a restore drill is scored by rdsops, Trollzilla takes the region down |
| `tools/check-links.mjs` | Every tutorial link answers |

## Architecture decisions

- [ADR 0001: Run the real rules in the browser](docs/adr/0001-run-the-real-rules-in-the-browser.md)
- rdsops [ADR 0006](https://github.com/iDan-Armstrong/rds-geodatabase-ops/blob/main/docs/adr/0006-checks-are-pure-functions-over-snapshots.md):
  checks are pure functions over snapshots, which is what makes this game possible.

## Credits

Trollzilla is an original creature. Pyodide is MPL-2.0. SIMServo is MIT.
