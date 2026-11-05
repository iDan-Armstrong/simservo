// Tutorials: the intro, and one per level that adds something. Every link is real and
// is checked by CI (tools/check-links.mjs) on each push.

const RDSOPS = "https://github.com/iDan-Armstrong/rds-geodatabase-ops";

export const LINKS = {
  rdsops: { title: "rds-geodatabase-ops: the real tool behind this game", url: RDSOPS },
  rdsopsAdrPure: { title: "ADR 0006: checks are pure functions over snapshots", url: `${RDSOPS}/blob/main/docs/adr/0006-checks-are-pure-functions-over-snapshots.md` },
  rdsopsAdrMinor: { title: "ADR 0004: minor upgrades are gated by the Esri matrix", url: `${RDSOPS}/blob/main/docs/adr/0004-minor-upgrades-are-gated.md` },
  rdsopsRunbook: { title: "Runbook: major upgrade with RDS blue/green", url: `${RDSOPS}/blob/main/docs/runbooks/major-upgrade-blue-green.md` },
  rdsopsDrill: { title: "Runbook: restore drill (rdsops restore-drill)", url: `${RDSOPS}/blob/main/docs/runbooks/restore-drill.md` },
  awsPitrCli: { title: "AWS CLI: restore-db-instance-to-point-in-time", url: "https://docs.aws.amazon.com/cli/latest/reference/rds/restore-db-instance-to-point-in-time.html" },
  awsSnapshotsMgmt: { title: "AWS: Managing automated backups", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ManagingAutomatedBackups.html" },
  egisops: { title: "arcgis-enterprise-ops: the real ArcGIS Server checks behind this department", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops" },
  egisopsAdr3: { title: "ADR 0003: built from Esri's documentation until a live site", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0003-docs-based-until-a-live-site.md" },
  esriHealth: { title: "Esri REST: Health Check", url: "https://developers.arcgis.com/rest/services-reference/enterprise/health-check/" },
  esriMachines: { title: "Esri REST: Machines", url: "https://developers.arcgis.com/rest/enterprise-administration/server/machines/" },
  esriMachineStatus: { title: "Esri REST: Status - Machine", url: "https://developers.arcgis.com/rest/enterprise-administration/server/status/" },
  esriLicenses: { title: "Esri REST: Licenses", url: "https://developers.arcgis.com/rest/enterprise-administration/server/licenses/" },
  esriToken: { title: "Esri REST: Generate Token", url: "https://developers.arcgis.com/rest/enterprise-administration/server/generatetoken/" },
  rdsopsGdb: { title: "Enterprise geodatabase on RDS: setup notes", url: `${RDSOPS}/blob/main/docs/geodatabase-on-rds.md` },
  awsRds: { title: "AWS: What is Amazon RDS?", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html" },
  awsVpc: { title: "AWS: Working with a DB instance in a VPC (public access)", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html" },
  awsParams: { title: "AWS: Overview of parameter groups", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/parameter-groups-overview.html" },
  awsPgParams: { title: "AWS: Working with parameters on RDS for PostgreSQL", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Parameters.html" },
  awsBackups: { title: "AWS: Introduction to backups", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html" },
  awsPitr: { title: "AWS: Restoring a DB instance to a specified time", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html" },
  awsDelete: { title: "AWS: Deleting a DB instance (and deletion protection)", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html" },
  awsIam: { title: "AWS: IAM database authentication", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html" },
  awsPi: { title: "AWS: Performance Insights dashboard", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.UsingDashboard.Components.html" },
  awsMultiAz: { title: "AWS: Multi-AZ DB instance deployments", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html" },
  awsAutoscale: { title: "AWS: Storage autoscaling", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html" },
  awsPostgis: { title: "AWS: Managing spatial data with PostGIS", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.PostGIS.html" },
  awsBlueGreen: { title: "AWS: Blue/green deployment limitations", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-considerations.html" },
  pgVacuum: { title: "PostgreSQL: Routine vacuuming", url: "https://www.postgresql.org/docs/current/routine-vacuuming.html" },
  pgStats: { title: "PostgreSQL: The cumulative statistics system", url: "https://www.postgresql.org/docs/current/monitoring-stats.html" },
  pgAdmin: { title: "PostgreSQL: System administration functions", url: "https://www.postgresql.org/docs/18/functions-admin.html" },
  postgisIndex: { title: "PostGIS workshop: Spatial indexing", url: "http://postgis.net/workshops/postgis-intro/indexing.html" },
  postgisFaq: { title: "PostGIS FAQ: How do I use spatial indexes?", url: "https://postgis.net/documentation/faq/spatial-indexes/" },
  esriCloud: { title: "Esri: ArcGIS requirements for databases in the cloud", url: "https://doc.esri.com/en/arcgis-enterprise/latest/plan/databases-in-the-cloud.html" },
  esriPg: { title: "Esri: ArcGIS requirements for PostgreSQL", url: "https://doc.esri.com/en/arcgis-enterprise/latest/plan/database-requirements-postgresql.html" },
  esriPools: { title: "Esri: Configure service instance settings", url: "https://enterprise.arcgis.com/en/server/latest/administer/windows/configure-service-instance-settings.htm" },
  esriCompress: { title: "Esri: Compress (geodatabase)", url: "https://pro.arcgis.com/en/pro-app/latest/tool-reference/data-management/compress.htm" },
  esriMaint: { title: "Esri: Enterprise geodatabase maintenance tasks (PostgreSQL)", url: "https://pro.arcgis.com/en/pro-app/latest/help/data/geodatabases/manage-postgresql/enterprise-geodatabase-maintenance.htm" },
};

const L = (...keys) => keys.map((k) => LINKS[k]);

export const TUTORIALS = {
  intro: {
    title: "Welcome to the operations center",
    cards: [
      {
        heading: "What is real here",
        body: "SIMServo simulates a small GIS shop: one ArcGIS Server site and one Amazon RDS for PostgreSQL database holding an enterprise geodatabase. The network is pretend. The judgment is not: every warning you see comes from rdsops, a real administration tool, running inside this page. The same checks run against real databases.",
        links: L("rdsops", "rdsopsAdrPure"),
      },
      {
        heading: "Findings",
        body: "Each scan returns findings with a code (like INV002), a severity (ok, info, WARN, FAIL) and the fix. Codes are stable: what you learn here is what the real tool prints. FAIL means something is broken or exposed. WARN means it will be.",
        links: L("rdsops"),
      },
      {
        heading: "Actions are real commands",
        body: "Click a finding to see what you can do about it. Every action shows the command a real administrator would run: an AWS CLI call, a SQL statement, or a console step. Some take game hours, some cost money every month.",
        links: L("awsRds", "pgAdmin"),
      },
      {
        heading: "Time, money and uptime",
        body: "One tick is one game hour. Business hours bring load. Your budget earns while the database is up and pays the AWS bill every hour. Downtime costs you twice. Earn XP by fixing things, finishing quests and surviving what the world throws at you.",
        links: [],
      },
      {
        heading: "Your first move",
        body: "Your database was built in a hurry. Run an inventory scan and look at what it says about public access.",
        links: L("awsVpc"),
      },
    ],
  },
  "level-1": null, // covered by the intro
  "level-2": {
    title: "Level 2: Health scans and the shop",
    cards: [
      {
        heading: "rdsops health",
        body: "The health scan connects to the database and reads what is happening now: connections against the limit, long queries, sessions idle in a transaction, lock waits, transaction ID age, replication slots, cache hits, and top queries.",
        links: L("pgStats", "rdsops"),
      },
      {
        heading: "Parameter groups",
        body: "Default parameter groups cannot be edited. The custom group from the Terraform module turns on pg_stat_statements and pgaudit and forces TLS. Attaching it needs a reboot, which is why it is worth doing early.",
        links: L("awsParams", "awsPgParams"),
      },
      {
        heading: "Backups",
        body: "Automated backups also set how far back point-in-time restore can go. One day is a demo setting. Seven is the baseline.",
        links: L("awsBackups", "awsPitr"),
      },
    ],
  },
  "level-3": {
    title: "Level 3: Maintenance, and the world starts happening",
    cards: [
      {
        heading: "rdsops maintenance",
        body: "Every UPDATE and DELETE leaves a dead row behind. Autovacuum cleans them, unless a transaction that started earlier is still open. The maintenance scan finds bloated tables, stale statistics, unused or duplicate indexes, invalid indexes, and spatial columns with no spatial index.",
        links: L("pgVacuum", "esriMaint"),
      },
      {
        heading: "Spatial indexes",
        body: "Without a GiST index, every map draw on a layer is a full table scan. A bulk load script that skips the index is one of the most common ways a map service suddenly gets slow.",
        links: L("postgisIndex", "postgisFaq"),
      },
      {
        heading: "Scenarios",
        body: "From now on things go wrong on their own: runaway reports, editors who leave a transaction open, connection storms. Each scenario is a real situation with a real fix.",
        links: L("esriPools", "pgAdmin"),
      },
    ],
  },
  "level-4": {
    title: "Level 4: ArcGIS Server joins the watch, plus slots, duplicates and doors",
    cards: [
      {
        heading: "egisops server-health",
        body: "Your ArcGIS Server site is now scanned by a second real tool. It asks the public health check the way a load balancer would, compares each machine's real-time state with what it should be, finds the license that expires soonest, and reads the TLS certificate straight from the connection.",
        links: L("egisops", "esriHealth", "esriMachineStatus"),
      },
      {
        heading: "Self-signed certificates",
        body: "A fresh ArcGIS Server ships with a self-signed certificate so it can start at all. Browsers, ArcGIS Pro and federation do not trust it. Replacing it with a CA-signed certificate is one of the first jobs on a new site, and certificates expire, so it comes back.",
        links: L("esriMachines", "egisopsAdr3"),
      },
      {
        heading: "Replication slots",
        body: "A logical replication slot keeps every byte of WAL its consumer has not read. If the consumer is gone (a deleted migration task, a blue/green leftover), the slot quietly fills the disk.",
        links: L("pgStats", "awsAutoscale"),
      },
      {
        heading: "Public access and IAM auth",
        body: "An RDS instance only needs a public endpoint if clients outside the VPC connect, and ArcGIS clients should be in the same VPC. IAM database auth lets admins connect with 15-minute tokens instead of stored passwords.",
        links: L("awsVpc", "awsIam"),
      },
    ],
  },
  "level-5": {
    title: "Level 5: Availability",
    cards: [
      {
        heading: "Multi-AZ",
        body: "A Multi-AZ instance keeps a synchronous standby in another Availability Zone and fails over in about a minute. It doubles the instance bill. Whether that is worth it is a business decision the scenarios will help you make.",
        links: L("awsMultiAz"),
      },
      {
        heading: "Scaling up",
        body: "A bigger instance class raises max_connections and memory. Tune ArcGIS Server service pools first: it is free, and it is usually the actual problem.",
        links: L("esriPools"),
      },
    ],
  },
  "level-6": {
    title: "Level 6: Restore drills",
    cards: [
      {
        heading: "A backup you never restored is a hope",
        body: "rdsops restore-drill restores your instance to a throwaway copy, times how long until the copy is usable, connects and checks the data, then deletes the copy. The source is never touched. Run one from the Operations panel; the real rdsops scores it.",
        links: L("rdsopsDrill", "awsPitr"),
      },
      {
        heading: "RTO and RPO",
        body: "Recovery time objective (RTO): how long until people can work again. Recovery point objective (RPO): how much recent data you can afford to lose. Point-in-time restore gets RPO down to about five minutes; a nightly snapshot means up to a day of lost edits. Your targets for now: RTO 60 minutes, RPO 15.",
        links: L("awsBackups", "awsSnapshotsMgmt"),
      },
      {
        heading: "Accidents and audits",
        body: "From now on someone may drop a table, and the only way back is a point-in-time restore to just before it happened. That only works if backups are on and the moment is inside the retention window, which is why seven days matters. Auditors may also ask for proof that restores work.",
        links: L("awsPitrCli", "awsDelete"),
      },
    ],
  },
  "level-7": {
    title: "Level 7: Versions and the Esri support matrix",
    cards: [
      {
        heading: "rdsops compat",
        body: "Esri certifies specific RDS for PostgreSQL versions for each ArcGIS release, and blocks some PostGIS versions. PostGIS 3.5.3 and 3.6.0 broke SRID creation in enterprise geodatabases (PostGIS issue 5978).",
        links: L("esriCloud", "esriPg", "awsPostgis"),
      },
      {
        heading: "Why auto minor upgrades are off",
        body: "If RDS patches the engine on its own schedule, nobody checks the Esri matrix first. The real module turns auto minor upgrades off and patches through a runbook.",
        links: L("rdsopsAdrMinor", "rdsopsRunbook", "awsBlueGreen"),
      },
    ],
  },
  "level-8": {
    title: "Level 8: Production mode and wraparound",
    cards: [
      {
        heading: "Availability gaps are now failures",
        body: "rdsops inventory has a --production flag. With it, single-AZ, short backup retention and missing deletion protection stop being warnings and become failures. Your shop just became production.",
        links: L("awsDelete", "awsMultiAz", "awsBackups"),
      },
      {
        heading: "The 2-billion-transaction clock",
        body: "PostgreSQL transaction IDs wrap around after about 2 billion. Vacuum freezes old rows so that never matters. If freezing falls behind, the database eventually stops accepting writes to protect itself.",
        links: L("pgVacuum"),
      },
    ],
  },
  "level-9": {
    title: "Level 9: Busier days",
    cards: [
      {
        heading: "More happens",
        body: "Scenarios arrive more often. Keep the fundamentals in place and the busy days stay boring.",
        links: L("esriCompress", "esriMaint"),
      },
    ],
  },
  "level-10": {
    title: "Level 10: Tier One complete",
    cards: [
      {
        heading: "Something large is out there",
        body: "Rare events are now possible. Some of them do not care about Availability Zones. The next tiers (monitoring, upgrades, restore drills, ArcGIS Server) arrive as the real tools behind them are built.",
        links: L("awsPitr", "rdsopsGdb"),
      },
    ],
  },
};

TUTORIALS["level-41"] = {
  title: "Level 41: A second machine",
  cards: [
    {
      heading: "Multi-machine sites",
      body: "Your site now has two ArcGIS Server machines behind the web adaptor. If one stops, the health check still passes because the other serves, but half your capacity is gone. server-health reports each machine separately for exactly that reason.",
      links: [LINKS.esriMachines, LINKS.esriMachineStatus, LINKS.esriHealth],
    },
    {
      heading: "Renewals on a calendar",
      body: "Licenses and certificates expire on dates you can see a year ahead. The admins who never have an outage over them put the dates in a calendar and renew at 30 days, not at zero.",
      links: [LINKS.esriLicenses, LINKS.esriToken],
    },
  ],
};

TUTORIALS["level-31"] = {
  title: "Level 31: Snapshot drills and tighter targets",
  cards: [
    {
      heading: "Snapshots versus point in time",
      body: "A snapshot drill restores the newest snapshot instead of a point in time. It is how you would recover in another account or region from a copied snapshot, and it shows how much data a snapshot-only plan would lose. Your recovery time target is now 30 minutes.",
      links: [LINKS.rdsopsDrill, LINKS.awsSnapshotsMgmt, LINKS.awsPitr],
    },
  ],
};

export function allLinks() {
  const seen = new Map();
  for (const t of Object.values(TUTORIALS)) {
    if (!t) continue;
    for (const c of t.cards) for (const l of c.links) seen.set(l.url, l.title);
  }
  for (const l of Object.values(LINKS)) seen.set(l.url, l.title);
  return [...seen.entries()].map(([url, title]) => ({ url, title }));
}
