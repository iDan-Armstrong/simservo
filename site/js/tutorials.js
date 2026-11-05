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
  esriServicesRoot: { title: "Esri REST: Services/Root Folder", url: "https://developers.arcgis.com/rest/enterprise-administration/server/services/" },
  esriReport: { title: "Esri REST: Services Report", url: "https://developers.arcgis.com/rest/enterprise-administration/server/servicesreport/" },
  esriLogs: { title: "Esri REST: Query - Logs", url: "https://developers.arcgis.com/rest/enterprise-administration/server/logsquery/" },
  egisopsAdr4: { title: "ADR 0004: where Esri's docs are ambiguous", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0004-ambiguous-docs.md" },
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
  esriPortalHealth: { title: "Esri REST: Health Check (Portal)", url: "https://developers.arcgis.com/rest/enterprise-administration/portal/health-check-portal/" },
  esriPortalLicense: { title: "Esri REST: License (Portal)", url: "https://developers.arcgis.com/rest/enterprise-administration/portal/license/" },
  esriFedValidate: { title: "Esri REST: Validate - Servers (federation)", url: "https://developers.arcgis.com/rest/enterprise-administration/portal/validate-servers/" },
  esriIndexer: { title: "Esri REST: Status - Indexer", url: "https://developers.arcgis.com/rest/enterprise-administration/portal/indexer-status/" },
  esriPortalHa: { title: "Esri: Configuring a highly available portal", url: "https://enterprise.arcgis.com/en/portal/11.4/administer/windows/configuring-a-highly-available-portal.htm" },
  esriDsValidate: { title: "Esri REST: Validate (ArcGIS Data Store)", url: "https://developers.arcgis.com/rest/enterprise-administration/server/validatedatastore/" },
  esriDsUtilities: { title: "Esri: ArcGIS Data Store utility reference (backupdatastore, describedatastore)", url: "https://enterprise.arcgis.com/en/data-store/11.5/install/windows/data-store-utility-reference.htm" },
  awsAuroraReplica: { title: "AWS: Migrating RDS for PostgreSQL to Aurora with an Aurora read replica", url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.RDSPostgreSQL.Replica.html" },
  awsAuroraSnapshot: { title: "AWS: Migrating an RDS for PostgreSQL snapshot to Aurora", url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.RDSPostgreSQL.Import.Console.html" },
  awsGovCloud: { title: "AWS GovCloud (US) User Guide", url: "https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/welcome.html" },
  awsArn: { title: "AWS: ARN format and partitions", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html" },
  rdsopsFleet: { title: "rdsops fleet: every geodatabase instance in one view", url: `${RDSOPS}#fleet` },
  rdsopsAurora: { title: "Runbook: move an RDS geodatabase to Aurora (rdsops aurora-plan)", url: `${RDSOPS}/blob/main/docs/runbooks/aurora-migration.md` },
  rdsopsAdrAurora: { title: "ADR 0007: Aurora as a migration target", url: `${RDSOPS}/blob/main/docs/adr/0007-aurora-as-a-migration-target.md` },
  esriUpgrade: { title: "Esri: Upgrade ArcGIS Enterprise (paths, order, retired features)", url: "https://doc.esri.com/en/arcgis-enterprise/latest/deploy/upgrade-arcgis-enterprise.html" },
  esriUpgradeDs: { title: "Esri: Upgrade ArcGIS Data Store", url: "https://doc.esri.com/en/arcgis-enterprise/latest/deploy/upgrade-data-store.html" },
  egisopsAdr7: { title: "ADR 0007: stack-compat uses rdsops for the database", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0007-stack-compat-uses-rdsops.md" },
  esriWgBackup: { title: "Esri: Create an ArcGIS Enterprise backup", url: "https://doc.esri.com/en/arcgis-enterprise/latest/administer/create-web-gis-backup.html" },
  esriWgProps: { title: "Esri: WebGISDR tool properties file", url: "https://doc.esri.com/en/arcgis-enterprise/latest/administer/populate-webgisdr-tool-properties-file.html" },
  esriWgOutput: { title: "Esri: WebGISDR tool output file", url: "https://doc.esri.com/en/arcgis-enterprise/latest/administer/webgisdr-tool-output-file.html" },
  esriWgOverview: { title: "Esri: ArcGIS Enterprise backups (what is and is not included)", url: "https://doc.esri.com/en/arcgis-enterprise/latest/administer/overview-backup-restore-web-gis.html" },
  egisopsAdr6: { title: "ADR 0006: backup-check works on files and never repeats a secret", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0006-backup-check-works-on-files.md" },
  egisopsAdr5: { title: "ADR 0005: portal tokens and data store machine names", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0005-portal-tokens-and-data-store-machines.md" },
  rdsopsSecurity: { title: "rdsops security and incident (README)", url: `${RDSOPS}#security` },
  rdsopsIncidents: { title: "Runbook: security incidents on an RDS geodatabase", url: `${RDSOPS}/blob/main/docs/runbooks/security-incidents.md` },
  rdsopsAdr8: { title: "ADR 0008: incident playbooks print; they never act", url: `${RDSOPS}/blob/main/docs/adr/0008-incident-playbooks-print-never-act.md` },
  egisopsAdr8: { title: "ADR 0008: security reads settings, never secrets", url: "https://github.com/iDan-Armstrong/arcgis-enterprise-ops/blob/main/docs/adr/0008-security-reads-settings-not-secrets.md" },
  esriServerScan: { title: "Esri: Scan ArcGIS Server for security best practices", url: "https://doc.esri.com/en/arcgis-enterprise/latest/plan/scan-arcgis-server-for-security-best-practices.html" },
  esriPortalScan: { title: "Esri: Scan your portal for security best practices", url: "https://doc.esri.com/en/arcgis-enterprise/latest/administer/scan-your-portal-for-security-best-practices.html" },
  awsScram: { title: "AWS: Using SCRAM for PostgreSQL password encryption", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL_Password_Encryption_configuration.html" },
  awsSsl: { title: "AWS: Using SSL/TLS to encrypt a connection to a DB instance", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html" },
  nist80061: { title: "NIST SP 800-61 Rev. 3: Incident Response Recommendations (2025)", url: "https://csrc.nist.gov/pubs/sp/800/61/r3/final" },
  cisaFederal: { title: "CISA: Federal Incident Notification Guidelines", url: "https://www.cisa.gov/incident-notification-guidelines" },
  rdsopsResilience: { title: "rdsops resilience and failover-drill (README)", url: `${RDSOPS}#resilience` },
  rdsopsDr: { title: "Runbook: zone and Region loss for an RDS geodatabase", url: `${RDSOPS}/blob/main/docs/runbooks/disaster-recovery.md` },
  rdsopsAdr9: { title: "ADR 0009: recovery times are measured, not guessed", url: `${RDSOPS}/blob/main/docs/adr/0009-recovery-times-are-measured-not-guessed.md` },
  awsFailover: { title: "AWS: Failing over a Multi-AZ DB instance (and the JVM DNS TTL)", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html" },
  awsReplicateBackups: { title: "AWS: Replicating automated backups to another Region", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReplicateBackups.html" },
  awsPgReplicas: { title: "AWS: Working with PostgreSQL read replicas", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PostgreSQL.Replication.ReadReplicas.html" },
  awsCopySnapshot: { title: "AWS API: CopyDBSnapshot (KMS keys in the destination Region)", url: "https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CopyDBSnapshot.html" },
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
    title: "Level 5: Services, logs and availability",
    cards: [
      {
        heading: "egisops services",
        body: "Every ArcGIS Server service has a configured state (what an admin asked for) and a real-time state (what is actually happening). A service configured to run that is not running fails every request. The report also shows each pool's busy and maximum instances: when all are busy, new requests wait.",
        links: L("esriReport", "esriServicesRoot", "egisops"),
      },
      {
        heading: "egisops logs",
        body: "ArcGIS Server logs every failure, so one broken service can write hundreds of SEVERE lines a day. The logs check groups them by source and code so you see one problem, not three hundred lines. Errors stay in the 24-hour window after you fix the cause, so the count falls the next day.",
        links: L("esriLogs", "egisopsAdr4"),
      },
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
    title: "Level 9: Portal for ArcGIS joins the watch",
    cards: [
      {
        heading: "egisops portal-health",
        body: "Your portal is now scanned by the real egisops portal-health. It asks the portal's own health check, checks each portal machine, finds the user type license that expires soonest, counts member licenses, asks the portal to validate its federated servers, and compares the search index with what is actually stored.",
        links: L("egisops", "esriPortalHealth", "egisopsAdr5"),
      },
      {
        heading: "Federation and the hosting server",
        body: "Your ArcGIS Server is federated with the portal and is its hosting server: hosted feature layers live in its ArcGIS Data Store. Federation validation is the portal checking that server, and its data store, from the outside. When the hosting server has a problem, the portal tells you here first.",
        links: L("esriFedValidate"),
      },
      {
        heading: "User types and the search index",
        body: "Every member holds a user type license (Creator, Field Worker, Viewer and so on), and each type has a fixed number. When they run out, nobody new can join. Separately, the portal keeps a search index; if it falls behind the stored content, people cannot find layers that are there.",
        links: L("esriPortalLicense", "esriIndexer"),
      },
      {
        heading: "One machine or two",
        body: "A single portal machine is a single point of failure. A second machine in a highly available pair keeps the site up when one stops. The shop now sells one. Scenarios also arrive more often from this level on.",
        links: L("esriPortalHa"),
      },
    ],
  },
  "level-10": {
    title: "Level 10: Tier One complete, and ArcGIS Data Store",
    cards: [
      {
        heading: "egisops datastore",
        body: "The hosting server's ArcGIS Data Store is now validated by the real egisops datastore. It runs Esri's own validate operation, then reads the machine list itself: Esri's documentation shows a data store reporting Healthy while a machine is missing, so the summary line is not trusted on its own.",
        links: L("egisops", "esriDsValidate"),
      },
      {
        heading: "Standby and backups",
        body: "A relational data store with one machine is down whenever that machine is. A standby machine takes over as primary. Data Store also writes its own backups; the check reports the age of the newest one, and a full backup share stops them silently.",
        links: L("esriDsUtilities"),
      },
      {
        heading: "Something large is out there",
        body: "Rare events are now possible. Some of them do not care about Availability Zones. Later tiers arrive as the real tools behind them are built.",
        links: L("awsPitr", "rdsopsGdb"),
      },
    ],
  },
};

TUTORIALS["level-11"] = {
  title: "Level 11: Back up the whole site with WebGISDR",
  cards: [
    {
      heading: "One file for the whole deployment",
      body: "RDS snapshots protect your geodatabase. They do not protect the portal's items, the services and their settings, federation, or the hosted feature layers in ArcGIS Data Store. Esri's WebGISDR tool exports all of that into one .webgissite file, and the same tool restores it.",
      links: L("esriWgBackup", "esriWgOverview"),
    },
    {
      heading: "egisops backup-check",
      body: "The real egisops backup-check now reads your webgisdr.properties file, your backup folder and the JSON the tool writes after each run. It checks the settings, scores the newest backup against a 24-hour recovery point objective, and reports which part of the last run failed. Right now there is no backup at all.",
      links: L("egisops", "esriWgProps", "esriWgOutput", "egisopsAdr6"),
    },
    {
      heading: "Schedule it, then watch it",
      body: "Run one export now, then schedule it nightly. Backups that depend on a scheduled task stop without an error when someone disables the task, so the age of the newest backup is the number to watch. Map caches and referenced data are not in the file; back those up too.",
      links: L("esriWgOverview"),
    },
  ],
};

TUTORIALS["level-12"] = {
  title: "Expansion: The 12.1 Upgrade",
  cards: [
    {
      heading: "What the site really runs",
      body: "Until now the compat scan checked your database against ArcGIS Enterprise 12.1, the release in the project plan. The real egisops stack-compat now reads what Portal, the hosting server and ArcGIS Data Store actually run: 11.5. And the database team moved RDS to PostgreSQL 17 for that 12.1 project. ArcGIS Enterprise 11.5 does not support PostgreSQL 17.",
      links: L("egisops", "egisopsAdr7", "esriPg"),
    },
    {
      heading: "The fix is the upgrade",
      body: "Rolling the database back is not on the table. The way out is to finish the job: upgrade the whole deployment to 12.1, which supports PostgreSQL 17. The Expansion panel tracks the campaign. Chapter one is preparation: Esri says to take a backup before upgrading any component, and to move off features retired at 12.0, like Web AppBuilder, while still on 11.5.",
      links: L("esriUpgrade"),
    },
    {
      heading: "Order matters",
      body: "Esri's order is Portal, the hosting server, then ArcGIS Data Store. While they are on different releases, stack-compat fails, because all base components must run the same version. Each step takes its component down for a few hours, and its usual fixes wait until the upgrade finishes. Pick your hours.",
      links: L("esriUpgrade", "esriUpgradeDs"),
    },
  ],
};

TUTORIALS["expansion-2"] = {
  title: "Chapter 2: Upgrade in order",
  cards: [
    {
      heading: "Backup taken, retired apps gone",
      body: "You can now upgrade. Start with Portal for ArcGIS. When it is done, stack-compat will fail: Portal on 12.1, everything else on 11.5. That is expected until the last component is upgraded.",
      links: L("esriUpgrade"),
    },
  ],
};

TUTORIALS["expansion-3"] = {
  title: "Chapter 3: Finish",
  cards: [
    {
      heading: "One release again",
      body: "Portal, the hosting server and ArcGIS Data Store are on 12.1, and PostgreSQL 17 is supported again. One thing is left: ArcGIS Pro 3.5 is not the companion of 12.1. Roll out Pro 3.7, then scan. The expansion ends when stack-compat has nothing to warn about.",
      links: L("esriUpgrade"),
    },
  ],
};

TUTORIALS["expansion-finale"] = {
  title: "Expansion complete: ArcGIS Enterprise 12.1",
  cards: [
    {
      heading: "Twelve One",
      body: "The whole stack runs 12.1 on a supported database, and you did it in Esri's order with a backup in hand. Next on the horizon: a full move and migration.",
      links: L("esriUpgrade", "egisops"),
    },
  ],
};

TUTORIALS["level-14"] = {
  title: "Level 14: A client is calling",
  cards: [
    {
      heading: "Expansion 2: The Takeover",
      body: "A federal client wants your operations center to run its ArcGIS site. First, they want their geodatabase moved from RDS for PostgreSQL to Aurora. The work opens once your own site is on 12.1, so finish The 12.1 Upgrade first if you have not.",
      links: L("rdsopsAurora"),
    },
  ],
};

TUTORIALS["takeover-1"] = {
  title: "The Takeover: Due diligence",
  cards: [
    {
      heading: "A client in GovCloud",
      body: "The Northwind Survey Agency (a made-up client) runs ArcGIS Enterprise 12.1 on RDS for PostgreSQL 17.5 in AWS GovCloud (US). GovCloud is its own AWS partition: ARNs read arn:aws-us-gov, and services and versions can arrive there later than in other Regions.",
      links: L("awsGovCloud", "awsArn"),
    },
    {
      heading: "rdsops aurora-plan",
      body: "The real rdsops aurora-plan now reads the client's facts. It picks the Aurora version: the lowest one the Region offers that AWS allows for the source and Esri supports for 12.1. Then it checks the read replica method's preconditions, encryption and room for WAL. Its findings carry a client tag.",
      links: L("rdsops", "rdsopsAdrAurora", "esriCloud"),
    },
    {
      heading: "Clear the blockers",
      body: "Chapter one ends when aurora-plan stops objecting. An abandoned Aurora cluster from an earlier attempt blocks a new replica. WAL for the replica piles up on the source, so it needs free storage. The source is not encrypted, which is a failure in GovCloud; the new cluster will be, with a customer-managed key. And Esri's minimum Aurora version may not be in GovCloud yet.",
      links: L("awsAuroraReplica"),
    },
  ],
};

TUTORIALS["takeover-2"] = {
  title: "The Takeover: Replicate",
  cards: [
    {
      heading: "Blockers cleared",
      body: "Create the Aurora cluster as a read replica of the client's instance. It copies the data, then follows the source until it catches up. The client keeps working the whole time. Watch the lag fall and the WAL grow on the source.",
      links: L("awsAuroraReplica"),
    },
  ],
};

TUTORIALS["takeover-3"] = {
  title: "The Takeover: Cutover",
  cards: [
    {
      heading: "Caught up",
      body: "Replica lag is zero. Now the short outage: stop the services that write, promote the cluster, point the client's registered data stores and connection files at the cluster endpoint, and start the services again. Every hour writes are stopped counts against you. Then add a reader in a second Availability Zone, since there was no Multi-AZ during the move.",
      links: L("awsAuroraReplica", "rdsopsAurora"),
    },
  ],
};

TUTORIALS["takeover-finale"] = {
  title: "The Takeover: complete",
  cards: [
    {
      heading: "Under new management",
      body: "The client runs on Aurora PostgreSQL 17.6, encrypted, with a reader in a second zone, and rdsops compat agrees Esri supports it. They signed. Their site is now yours to watch.",
      links: L("rdsopsAurora"),
    },
  ],
};

TUTORIALS["fleet"] = {
  title: "Fleet Command",
  cards: [
    {
      heading: "More than one database",
      body: "Word got around. The client's test instance is now yours, and more sites will join every few days, each with the problems inherited databases have. The real rdsops fleet scores all of them at once: the same posture and Esri checks as inventory and compat, per instance, plus what only shows across many, like version drift and instances nobody tagged with their ArcGIS release.",
      links: L("rdsopsFleet", "rdsops"),
    },
    {
      heading: "What it covers",
      body: "rdsops fleet reads RDS for PostgreSQL instances in every Region you give it, GovCloud included through its own profile. The client's Aurora cluster is not in it; rdsops operates RDS instances. Each site pays while it is under contract, and each failing site costs you every hour.",
      links: L("rdsopsAdrAurora", "awsGovCloud"),
    },
  ],
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

TUTORIALS["level-15"] = {
  title: "Security Operations",
  cards: [
    {
      heading: "Your posture, scored",
      body: "Two more real checks join your scans. rdsops security looks deeper than inventory: is TLS required, are passwords stored with SCRAM or md5, is the certificate current, is the port open to the internet, are snapshots shared, do keys and secrets rotate, is there an audit trail. egisops security reads the settings Esri's own serverScan checks: HTTPS only, token requests, the services directory, cross-domain access and the primary site administrator.",
      links: L("rdsopsSecurity", "esriServerScan", "awsScram", "awsSsl"),
    },
    {
      heading: "Attacks follow what is open",
      body: "From now on, attackers come. What you leave open decides what they try: tokens over GET draw token theft, an enabled primary site administrator draws admin takeovers, md5 passwords draw credential attacks. A hardened site still sees the odd incident, and the database certificate runs out in 20 days whether you are ready or not.",
      links: L("egisopsAdr8", "esriPortalScan"),
    },
    {
      heading: "Incident response",
      body: "When an incident lands, the real rdsops incident or egisops incident writes the playbook for it, filled in for your instance or site. You choose the order. The incident clock runs with every step, and the attacker keeps doing damage until you contain it. The rules come from the playbook: keep the evidence it keeps before anything that destroys it, contain before you recover, and leave the review for last. Contingencies happen: an open session after a password change, a second open rule, a certificate rotation that breaks ArcGIS.",
      links: L("rdsopsIncidents", "rdsopsAdr8", "nist80061"),
    },
    {
      heading: "Federal clients",
      body: "If an incident hits the Northwind Survey Agency, a federal client in GovCloud, the CISA report is due within one hour of identification. Report what you know early; the investigation can follow. Contractors report through the agency and their contract terms.",
      links: L("cisaFederal"),
    },
  ],
};

TUTORIALS["incident"] = {
  title: "Incident",
  cards: [
    {
      heading: "The clock is running",
      body: "The game is paused while you work. Each step takes incident minutes, and until you contain it the attacker keeps causing damage. Pick the steps in the order you would run them. Nothing here touches a real system; the commands are the ones the real playbook prints.",
      links: L("rdsopsIncidents", "nist80061"),
    },
  ],
};

TUTORIALS["level-16"] = {
  title: "High Availability and DR",
  cards: [
    {
      heading: "Two questions",
      body: "If the zone goes, how long until ArcGIS works again and how much data is lost? Same question for the whole Region. The real rdsops resilience lists every recovery path you have for each, with its data loss from AWS timestamps, and scores them against your targets. Multi-AZ answers the zone question: AWS documents failover as typically 60 to 120 seconds, with no data lost. It does nothing for a Region.",
      links: L("rdsopsResilience", "awsFailover"),
    },
    {
      heading: "A copy somewhere else",
      body: "For a Region: replicate automated backups to us-west-2 (the cheapest real option, minutes of data loss), or keep a cross-Region read replica (faster, bills like a second instance, and promoting it cannot be undone). Snapshot copies lose everything since the copy. Encrypted copies need a KMS key in the DR Region first.",
      links: L("awsReplicateBackups", "awsPgReplicas", "awsCopySnapshot", "rdsopsDr"),
    },
    {
      heading: "Measured, not hoped",
      body: "Until you drill it, the tool says your recovery time was never measured. A zone drill forces a real failover in a window you announce. A Region drill restores a scratch copy in us-west-2, proves ArcGIS can use it, and deletes it; it never promotes the real replica. Watch the gap between the database coming back and ArcGIS coming back: that is usually DNS caching in ArcGIS Server's JVM.",
      links: L("rdsopsAdr9"),
    },
    {
      heading: "The bad day",
      body: "Sometimes a whole Region has a very bad day. With a copy in us-west-2 you can fail over; a path you drilled goes as measured, one you never practised costs hours of finding the runbook, the key and the ARN while everything is down.",
      links: L("rdsopsDr"),
    },
  ],
};

