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
| The checks: rdsops `inventory`, `health`, `maintenance`, `compat`, `restore-drill`, `aurora-plan`, `fleet`, `security`, `incident`, `resilience`, `failover-drill` and egisops `server-health`, `services`, `logs`, `portal-health`, `datastore`, `backup-check`, `stack-compat`, `security`, `incident`, each at a pinned commit | The network: one VPC, one ArcGIS Server site, one RDS instance |
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

- 100 levels in ten tiers, all playable, each backed by a real tool: Fundamentals,
  Monitoring and Maintenance, Versions and Upgrades, Backup and Restore, ArcGIS Server,
  Portal and Federation, Data Store, Security Operations, High Availability and DR, and
  Fleet Command.
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
- **Expansion 1, The 12.1 Upgrade**, from level 12. The real `egisops stack-compat` (with
  rdsops `compat` inside it) reads what the site actually runs: 11.5, on a database the team
  already moved to PostgreSQL 17, which 11.5 does not support. The way out is Esri's upgrade:
  a fresh WebGISDR backup and Web AppBuilder apps rebuilt first, then Portal, the hosting
  server and ArcGIS Data Store in order (each down for hours, with stack-compat failing while
  releases are mixed and out-of-order steps refused with Esri's reason), then ArcGIS Pro to
  its companion version. The campaign ends when stack-compat has nothing to warn about.
- **Expansion 2, The Takeover**, from level 14 once the 12.1 Upgrade is done. A client,
  the Northwind Survey Agency (made up), runs ArcGIS 12.1 on RDS for PostgreSQL 17.5 in
  AWS GovCloud (US) and wants Aurora before your center takes it over. The real
  `rdsops aurora-plan` reads the client's facts and its findings decide when due diligence
  is done: an abandoned Aurora cluster blocking a new replica, too little room for WAL, an
  unencrypted source (a failure in GovCloud), and Esri's minimum Aurora version not yet
  offered in the Region until AWS ships it there. Then the replica catches up while WAL
  grows, and the cutover (stop writes, promote, re-point the data stores, add a reader) is
  timed against the client. After promotion the real `rdsops compat --platform aurora`
  checks the cluster.
- **Fleet Command**, after The Takeover. The client's RDS test instance is yours, and six
  more sites (all made up) arrive a few game days apart, each with inherited problems:
  public endpoints, one-day backups, no encryption, untagged releases, drifted minors. The
  real `rdsops fleet` scores every instance across Regions, GovCloud included, with the
  same posture and Esri checks as inventory and compat plus fleet-wide drift. Fixes per
  site: the Terraform baseline, a patch to the certified minor, a release tag, Multi-AZ,
  or encryption by snapshot copy. Sites pay while under contract; failing ones cost.
- **Security Operations** from level 15. The real `rdsops security` and `egisops security`
  score the posture the game keeps for your database and site: TLS not required, md5
  passwords, a certificate running out in 20 days, the port open to the internet, a
  snapshot shared with an unknown account, no audit trail, tokens over GET, the services
  directory open, the primary site administrator enabled. Each finding has its fix.
  What stays open draws attacks: eleven kinds, six from `rdsops incident` (credentials,
  AWS keys, exposure, destruction, exfiltration, certificate) and five from
  `egisops incident` (admin account, tokens, exposed service, content, a compromised
  machine). When one lands the game pauses and the real tool writes the playbook for your
  instance or site. You pick the order; steps cost incident minutes and the attacker does
  damage until contained. The rules come from the playbook itself: running a step that
  destroys evidence ahead of the evidence the playbook keeps first is lost evidence,
  recovering before containment lets the attacker back in, the review comes last, and a
  federal client's CISA report is due within one hour. Contingencies add steps when the
  situation calls for them: a session still open after a password change, a second open
  rule, an instance deleted because deletion protection was off, a restore window too
  short, a CA rotation that breaks ArcGIS, a leaked key used in another Region, the
  primary site administrator used to get back in, a KMS key scheduled for deletion.
- **High Availability and DR** from level 16. The real `rdsops resilience` lists every
  way back from losing the zone or the Region (Multi-AZ, point-in-time restore,
  replicated automated backups in us-west-2, a cross-Region replica, snapshot copies),
  with the data each would lose and the time each takes, against your targets. Time is
  never guessed: until you drill a path, it says so. Zone and Region drills go through the
  real `rdsops failover-drill` plan and scoring; a Region drill restores a scratch copy and
  never promotes the real replica. ArcGIS Server's JVM caches DNS until restart, so the
  first zone drill shows the services coming back long after the database, and the fix is
  a 60-second TTL. A Region-wide outage (or Trollzilla) can now be failed over: a drilled
  path goes as measured, an undrilled one costs hours of finding the runbook on the day,
  and promoting the replica uses it up.
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
| `tests/test_bridge.py` | Every finding code the game uses exists in rdsops or egisops; every scenario raises the code it teaches through the real evaluators; with a Data Store standby, the same outage is only a warning; the takeover client's blockers and the promoted cluster run through the real rdsops aurora-plan and compat; all eight fleet instances run through the real rdsops fleet; the starting security posture fails the real checks for every fix the game offers and the hardened one passes; the playbook fixture matches the real tools; the DR setup as found and as built runs through the real rdsops resilience, and both drill kinds through the real failover-drill; drills plan and score through the real `restore-drill` |
| `tests/e2e/smoke.mjs` | The built site in Chromium: wizard loads real Pyodide and rdsops, self-test passes, glossary tooltips and search work, a finding is fixed through the UI, a stopped ArcGIS Data Store is caught by egisops and fixed, a WebGISDR export is taken through the UI and scored, the 12.1 expansion is played from the reveal to a clean stack, the takeover is played from the real aurora-plan blockers to a clean Aurora compat check, a fleet site arrives and a baseline fix through the panel changes what rdsops fleet reports, security findings come from the real tools and a federal incident is played through the console with the real playbook, a Region drill is scored by the real failover-drill and a Region outage is failed over along the drilled path, 48 game hours play, a restore drill is scored by rdsops, Trollzilla takes the region down |
| `tests/campaign.test.mjs` | The expansion end to end: unlock at 12, Esri's order and backup rule enforced, components unavailable while upgrading, chapters, finale |
| `tests/takeover.test.mjs` | Expansion 2 end to end: waits for the 12.1 Upgrade, GovCloud facts, the version arriving in the Region, AWS's order (no promotion while writing or lagging), the finale |
| `tests/secops.test.mjs` | Every real playbook (exported to a fixture) runs clean in its own order; evidence destroyed early, recovery before containment, a late CISA report and the review out of order are each caught; the contingencies fire; posture fixes change what the real tools read |
| `tests/dr.test.mjs` | DR opens at 16; backup replication needs the DR key and costs money; a zone drill needs Multi-AZ and exposes the DNS cache; drills measure the times the real tool uses; a drilled Region failover beats an undrilled one; promotion uses up the replica |
| `tests/fleet.test.mjs` | The fleet opens after the takeover, six sites arrive on schedule, fixes change the facts, GovCloud ARNs |
| `tools/check-links.mjs` | Every tutorial link answers |

## Architecture decisions

- [ADR 0001: Run the real rules in the browser](docs/adr/0001-run-the-real-rules-in-the-browser.md)
- rdsops [ADR 0006](https://github.com/iDan-Armstrong/rds-geodatabase-ops/blob/main/docs/adr/0006-checks-are-pure-functions-over-snapshots.md):
  checks are pure functions over snapshots, which is what makes this game possible.

## Credits

Trollzilla is an original creature. Pyodide is MPL-2.0. SIMServo is MIT.
