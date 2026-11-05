// Plain-language help for every technical term the game uses. Terms are found in game
// text automatically (see annotate) and shown as hover or tap tooltips; the Glossary
// panel lists them all. Keep each definition short, accurate and free of jargon that is
// not itself in this list.

export const TERMS = [
  // ---------------------------------------------------------------- the stack
  { term: "GIS", def: "Geographic information system: software and data for mapping and analyzing things by location." },
  { term: "AWS", def: "Amazon Web Services, Amazon's cloud. It rents servers, databases, storage and networking by the hour." },
  { term: "CLI", also: ["command line"], def: "Command-line interface: a program you run by typing commands, which also makes it easy to script and automate." },
  { term: "XP", also: ["experience points"], def: "Experience points in SIMServo. You earn them by fixing findings, finishing quests and riding out scenarios; enough XP raises your level." },
  { term: "ArcGIS Enterprise", def: "Esri's software for running GIS on your own servers: Portal for ArcGIS, ArcGIS Server, ArcGIS Data Store and the web adaptor, working together." },
  { term: "ArcGIS Server", def: "The part of ArcGIS Enterprise that publishes maps, layers and tools as web services and answers requests for them." },
  { term: "ArcGIS Pro", def: "Esri's desktop GIS application. Editors and analysts use it to work with the geodatabase and publish services." },
  { term: "Portal", also: ["Portal for ArcGIS"], def: "The website part of ArcGIS Enterprise where people sign in, find content and share maps. It sits in front of one or more ArcGIS Server sites." },
  { term: "web adaptor", def: "A small web application on IIS or Tomcat that receives traffic on the usual web port (443) and passes it to ArcGIS Server or Portal." },
  { term: "Amazon S3", also: ["S3"], def: "AWS object storage. Backups written to an S3 bucket live outside the servers they protect, and an IAM role can grant access without a stored key." },
  { term: "JSON", def: "A plain-text format for structured data. WebGISDR can write its result as JSON, which a script or egisops can read to see what happened." },
  { term: "fleet", def: "All the databases you run, across Regions and accounts, looked at together. Problems that only show across many, like version drift, show up here." },
  { term: "drift", also: ["version drift"], def: "Copies of the same thing slowly becoming different, such as instances on different minor versions. A fix tested on one may not hold on another." },
  { term: "Amazon Aurora", also: ["Aurora", "Aurora PostgreSQL"], def: "AWS's cluster database compatible with PostgreSQL. Storage is shared across Availability Zones and readers take over on failure. Esri lists which Aurora versions ArcGIS supports." },
  { term: "GovCloud", also: ["AWS GovCloud (US)", "AWS GovCloud"], def: "AWS Regions for US government workloads, in their own partition (ARNs start arn:aws-us-gov). Services and versions can reach them later than other Regions." },
  { term: "ARN", def: "Amazon Resource Name: the full ID of an AWS resource. Its partition part is aws in most Regions and aws-us-gov in GovCloud." },
  { term: "read replica", also: ["Aurora read replica"], def: "A copy that follows a source database by replaying its changes. An Aurora read replica of an RDS instance is how AWS moves it to Aurora with little downtime." },
  { term: "promote", also: ["promotion"], def: "Turning a replica into a standalone database that takes writes. After promotion it no longer follows the source." },
  { term: "cutover", def: "The planned moment users move from the old system to the new one. Writes stop, the new one takes over, connections are pointed at it." },
  { term: "Web AppBuilder", def: "Esri's older app builder for web apps. It was retired at ArcGIS Enterprise 12.0, so its apps must be rebuilt before upgrading past 11.5." },
  { term: "Experience Builder", def: "Esri's current app builder, the replacement for Web AppBuilder. Apps are rebuilt in it from the same maps and layers." },
  { term: "companion version", also: ["companion"], def: "The ArcGIS Pro release Esri pairs with an ArcGIS Enterprise release, such as Pro 3.7 with Enterprise 12.1. Esri recommends keeping them together." },
  { term: "upgrade order", def: "Esri's order for upgrading ArcGIS Enterprise: Portal and its Web Adaptor, the hosting server and its Web Adaptor, ArcGIS Data Store, then other federated servers." },
  { term: "properties file", also: ["webgisdr.properties"], def: "The settings file WebGISDR reads: the portal URL and admin account, where backups go, and the backup mode. Backslashes in its paths must be doubled." },
  { term: "webgissite", also: [".webgissite"], def: "The single backup file WebGISDR writes for the whole deployment. Restoring from a folder picks the newest one by last-modified time." },
  { term: "scheduled task", def: "A job the operating system runs on a schedule, such as Windows Task Scheduler or cron. Backups that depend on one stop silently if it is disabled." },
  { term: "hosting server", def: "The federated ArcGIS Server that Portal uses for hosted layers. It has ArcGIS Data Store registered with it, and publishing hosted layers goes through it." },
  { term: "hosted feature layer", also: ["hosted feature layers", "hosted layer", "hosted layers"], def: "A feature layer created in Portal whose data lives in ArcGIS Data Store, not in a geodatabase you manage. If the data store is down, these layers fail." },
  { term: "user type", also: ["user types", "user type license", "user type licenses"], def: "The license each Portal member holds, such as Creator, Field Worker or Viewer. Each type has a fixed count; when every one is assigned, no new member can get it." },
  { term: "search index", def: "Portal's index of users, groups and items. Searches read the index, so content that is stored but not indexed cannot be found until the index catches up or is rebuilt." },
  { term: "standby", also: ["standby machine"], def: "A second machine or copy kept in step with the primary and ready to take over if it fails. RDS Multi-AZ, a two-machine portal and a Data Store pair all work this way." },
  { term: "federation", also: ["federated"], def: "Linking an ArcGIS Server site to Portal so Portal handles sign-in and sharing for that server's services." },
  { term: "Data Store", also: ["ArcGIS Data Store"], def: "Esri-managed storage that holds data for hosted layers created in Portal, separate from your own geodatabases." },
  { term: "enterprise geodatabase", def: "An Esri data model stored inside a database such as PostgreSQL. It adds versioning, domains, relationship classes and more on top of plain tables." },
  { term: "geodatabase", def: "Esri's structure for storing GIS data and the rules around it. An enterprise geodatabase lives in a database server and supports many editors at once." },
  { term: "sde", def: "The database user that owns an enterprise geodatabase's system tables. Treat it as an application account, not a person's login." },
  { term: "versioning", also: ["versioned"], def: "A geodatabase feature that lets editors work in separate versions and merge later. It keeps extra tables that grow until a compress cleans them." },
  { term: "compress", def: "A geodatabase maintenance operation that folds edits from versioning tables back into the base tables and removes history no longer needed." },
  { term: "state and lineage tables", also: ["sde_state_lineages", "sde_states"], def: "Geodatabase system tables that track versioned edits. They grow with every edit until a compress runs." },
  { term: "feature class", def: "A geodatabase table whose rows are map features (points, lines or polygons) with a shape column." },
  { term: "MapServer", def: "An ArcGIS Server service type that draws map images and answers queries about the layers in a map." },
  { term: "FeatureServer", def: "An ArcGIS Server service type that serves features as data, and can allow editing over the web." },
  { term: "GPServer", def: "An ArcGIS Server service type that runs geoprocessing tools, such as the publishing tools ArcGIS uses itself." },
  { term: "service", def: "Something ArcGIS Server publishes for clients to use over the web: a map, a feature layer, a geoprocessing tool." },
  { term: "instance pool", also: ["max instances", "maximum instances", "instances busy", "instances"], def: "The set of server processes that answer requests for a service. When every instance is busy, new requests wait and can time out." },
  { term: "configured state", def: "What an administrator told ArcGIS Server a machine or service should be: STARTED or STOPPED." },
  { term: "real-time state", def: "What a machine or service is actually doing right now. When it differs from the configured state, something went wrong." },
  { term: "machine", def: "One server computer in an ArcGIS Server site. A site can have several machines sharing the work." },
  { term: "health check", def: "A web address a load balancer or monitor calls to ask a server whether it can take requests. A healthy server answers HTTP 200." },
  { term: "load balancer", def: "A device or service that spreads incoming requests across several servers and stops sending to ones that fail their health check." },
  { term: "license", also: ["licenses", "licensed"], def: "The authorization file that lets Esri software run. Licenses expire on a set date and must be renewed through My Esri." },
  { term: "My Esri", def: "Esri's customer website, where organizations download software and license files." },
  { term: "authorizeSoftware", def: "The ArcGIS command-line tool that applies a license file to an installed product." },
  { term: "SEVERE", def: "The highest ArcGIS Server log level: something failed. WARNING and INFO are less serious." },
  { term: "token", def: "A short-lived pass the ArcGIS admin API gives you after you sign in. Tools send it with each request instead of the password." },

  // ---------------------------------------------------------------- database
  { term: "PostgreSQL", also: ["Postgres"], def: "A widely used open-source relational database. Here it stores the enterprise geodatabase." },
  { term: "PostGIS", def: "The PostgreSQL extension that adds spatial types, functions and indexes. Enterprise geodatabases on RDS store shapes with it." },
  { term: "SQL", def: "The language used to query and manage relational databases." },
  { term: "max_connections", also: ["connections"], def: "The most client sessions PostgreSQL will allow at once. Past it, new connections are refused." },
  { term: "idle in transaction", def: "A session that started a transaction and stopped doing anything. It holds locks and stops vacuum from cleaning up until it ends." },
  { term: "lock wait", also: ["waiting on locks", "blocking session", "blocker"], def: "When one session needs a table or row that another session holds, it waits. Long waits stall applications." },
  { term: "transaction ID wraparound", also: ["Transaction ID age", "wraparound", "XID"], def: "PostgreSQL numbers transactions with IDs that wrap around after about 2 billion. Vacuum freezes old rows so it never matters; if it falls behind, the database stops writes to protect itself." },
  { term: "VACUUM", also: ["vacuum"], def: "PostgreSQL maintenance that reclaims space from dead rows and freezes old ones. Autovacuum runs it in the background." },
  { term: "autovacuum", def: "PostgreSQL's background process that runs VACUUM and ANALYZE when tables have changed enough." },
  { term: "dead rows", also: ["dead row"], def: "Old copies of rows left behind by updates and deletes. They take space and slow scans until vacuum removes them." },
  { term: "ANALYZE", also: ["planner statistics", "statistics"], def: "Collects statistics about a table's data so the query planner can pick good plans, such as using a spatial index." },
  { term: "index", also: ["indexes"], def: "A lookup structure that lets the database find rows without reading the whole table. Every index also slows writes a little." },
  { term: "spatial index", also: ["GiST", "GIST"], def: "An index on a geometry column (PostGIS uses GiST). Without one, every map draw scans the whole table." },
  { term: "duplicate index", also: ["duplicate indexes"], def: "Two indexes with the same definition. The second one adds write cost and disk use with no benefit." },
  { term: "invalid index", def: "An index left behind by a failed concurrent build. It is maintained on every write but never used." },
  { term: "CREATE INDEX CONCURRENTLY", also: ["DROP INDEX CONCURRENTLY"], def: "Builds (or drops) an index without blocking writes to the table. It takes longer and can fail, leaving an invalid index." },
  { term: "pg_stat_statements", def: "A PostgreSQL extension that records statistics for every query, so you can find the slowest and busiest ones." },
  { term: "pgaudit", def: "A PostgreSQL extension that logs who changed schema or permissions, for audit trails." },
  { term: "replication slot", also: ["slot"], def: "A bookmark that makes PostgreSQL keep write-ahead log until a consumer reads it. An abandoned slot keeps it forever and fills the disk." },
  { term: "WAL", also: ["write-ahead log"], def: "PostgreSQL's write-ahead log: a record of every change, written before the change itself. Used for crash recovery, replication and point-in-time restore." },
  { term: "logical replication", def: "Copying changes table by table (rather than disk blocks) to another database. Blue/green major upgrades use it." },
  { term: "SRID", def: "Spatial reference ID: the number that says which coordinate system a geometry uses, such as 4326 for latitude and longitude." },
  { term: "PostGIS issue 5978", also: ["issue 5978"], def: "A PostGIS change in 3.5.3 and 3.6.0 that broke SRID creation in Esri enterprise geodatabases. Esri lists those versions as unsupported." },
  { term: "cache hit ratio", def: "How often PostgreSQL finds the data it needs in memory instead of reading disk. Low values mean the working set does not fit in memory." },
  { term: "primary key", def: "A column (or set of columns) that uniquely identifies each row. Logical replication needs one to replicate updates and deletes." },
  { term: "large objects", also: ["large object"], def: "A PostgreSQL way of storing big binary values outside normal tables. Logical replication does not copy them." },
  { term: "unlogged table", also: ["unlogged tables"], def: "A PostgreSQL table that skips the write-ahead log for speed. It is not crash safe and is not replicated." },

  // ---------------------------------------------------------------- AWS
  { term: "Amazon RDS", also: ["RDS"], def: "Amazon Relational Database Service: AWS runs the database server (patching, backups, failover) and you manage the database." },
  { term: "AWS CLI", def: "Amazon's command-line tool for managing AWS services from a terminal or script." },
  { term: "VPC", def: "Virtual Private Cloud: your own private network inside AWS. Servers in it are not reachable from the internet unless you allow it." },
  { term: "security group", def: "An AWS firewall attached to a server or database that lists which sources may connect on which ports." },
  { term: "publicly accessible", also: ["public endpoint", "public access"], def: "An RDS setting that gives the database an address reachable from the internet. ArcGIS should connect from inside the VPC, so it should be off." },
  { term: "Availability Zone", also: ["AZ"], def: "One of several separate data centers in an AWS region, with its own power and network. An outage in one zone does not take down the others." },
  { term: "Multi-AZ", also: ["single-AZ", "Single-AZ"], def: "An RDS option that keeps a synchronized standby copy in a second Availability Zone and fails over to it automatically, in about a minute." },
  { term: "failover", def: "Switching to a standby copy when the primary fails, so service continues." },
  { term: "region", def: "A geographic AWS area, such as us-east-1, made up of several Availability Zones. Losing a whole region is rare and needs copies elsewhere." },
  { term: "instance class", also: ["db.t4g.micro", "db.t4g.small", "db.t4g.medium", "db.m7g.large"], def: "The size of an RDS server: CPU and memory. Bigger classes allow more connections and cost more per hour." },
  { term: "KMS", also: ["KMS key"], def: "AWS Key Management Service, which holds the encryption keys used for data at rest." },
  { term: "encrypted at rest", also: ["encryption at rest", "Storage encrypted"], def: "Data is encrypted on disk and in backups, so a stolen disk or snapshot is unreadable without the key." },
  { term: "IAM", def: "AWS Identity and Access Management: who and what may do which actions in an AWS account." },
  { term: "IAM database authentication", also: ["IAM auth"], def: "Signing in to RDS with a 15-minute token from your AWS identity instead of a stored database password." },
  { term: "Secrets Manager", also: ["master password", "master secret"], def: "AWS Secrets Manager stores passwords and rotates them. RDS can keep its master password there so no person ever knows it." },
  { term: "parameter group", also: ["default parameter group", "custom parameter group"], def: "A named set of PostgreSQL settings for an RDS instance. Default groups cannot be changed, so real work needs a custom one." },
  { term: "Performance Insights", def: "An RDS feature that shows what the database is waiting on and which queries load it most." },
  { term: "CloudWatch", def: "AWS monitoring: metrics, alarms and logs for AWS services, including RDS free storage and CPU." },
  { term: "storage autoscaling", also: ["autoscaling"], def: "An RDS option that grows the disk automatically when free space runs low, up to a ceiling you set. Disk can never shrink." },
  { term: "deletion protection", def: "An RDS setting that blocks deleting the instance until someone turns it off first." },
  { term: "Terraform", def: "A tool that creates cloud infrastructure from configuration files, so the setup is reviewed, repeatable and recorded." },
  { term: "auto minor version upgrade", also: ["auto minor upgrades", "Auto minor version upgrade"], def: "An RDS option that applies minor engine patches automatically in the maintenance window, without anyone checking compatibility first." },
  { term: "minor version", also: ["minor upgrade", "minor engine"], def: "A patch release within the same major version, such as 17.7 to 17.8. Usually bug and security fixes." },
  { term: "major version", also: ["major upgrade"], def: "A new PostgreSQL generation, such as 16 to 17. It can change behavior and needs planning and testing." },
  { term: "blue/green deployment", also: ["blue/green"], def: "An RDS upgrade method: build an upgraded copy (green) that stays in sync with production (blue), test it, then switch over in about a minute." },
  { term: "maintenance window", def: "The weekly time slot when RDS may apply pending changes and patches." },
  { term: "gp3", def: "An AWS SSD storage type for RDS with baseline performance included in the price." },

  // ---------------------------------------------------------------- backup and recovery
  { term: "snapshot", also: ["snapshots"], def: "A full backup of an RDS instance at one moment. Automated snapshots are taken daily; manual ones stay until you delete them." },
  { term: "automated backups", also: ["backup retention", "Backup retention", "backups"], def: "Daily snapshots plus continuous transaction logs that RDS keeps for a set number of days. Together they allow point-in-time restore." },
  { term: "point-in-time restore", also: ["point in time", "PITR"], def: "Restoring a database to any moment inside the backup window, often within about five minutes of now, as a new instance." },
  { term: "restore drill", also: ["drill", "drills"], def: "Practicing a restore on a throwaway copy, timing it and checking the data, so you know backups work before you need them." },
  { term: "RTO", also: ["recovery time"], def: "Recovery time objective: how long you can afford to be down. A restore drill measures how long it really takes." },
  { term: "RPO", also: ["data loss", "recovery point"], def: "Recovery point objective: how much recent data you can afford to lose. Point-in-time restore keeps it to minutes; nightly snapshots mean up to a day." },
  { term: "webgisdr", def: "Esri's backup and restore tool for a whole ArcGIS Enterprise deployment: Portal, federated servers and Data Store together." },

  // ---------------------------------------------------------------- security and web
  { term: "TLS", also: ["HTTPS", "SSL"], def: "The encryption behind HTTPS. A server proves who it is with a certificate before any data is exchanged." },
  { term: "certificate", also: ["certificates"], def: "A digital document that proves a server's identity for TLS. It is issued by a certificate authority and expires on a set date." },
  { term: "self-signed certificate", also: ["self-signed"], def: "A certificate a server issued to itself. It encrypts traffic, but browsers and ArcGIS Pro do not trust it because no authority vouches for it." },
  { term: "certificate authority", also: ["CA-signed", "CA"], def: "An organization (public or internal) that issues certificates. Clients trust certificates signed by authorities they know." },
  { term: "Esri support matrix", also: ["support matrix", "certified"], def: "Esri's published list of database versions each ArcGIS release supports. Running outside it means Esri support may decline to help." },
];

// Finding code prefixes: which real check produced the finding.
export const CODES = {
  INV: "Inventory (rdsops inventory): how the RDS instance is configured and secured.",
  HLT: "Health (rdsops health): what the database is doing right now.",
  MNT: "Maintenance (rdsops maintenance): vacuum, statistics and indexes.",
  CMP: "Compatibility (rdsops compat): versions against the Esri support matrix.",
  UPG: "Upgrade planning (rdsops upgrade-plan).",
  DRL: "Restore drill (rdsops restore-drill): backups proven by restoring them.",
  SRV: "Server health (egisops server-health): ArcGIS Server site, machines, license, certificate.",
  SVC: "Services (egisops services): ArcGIS Server services and their instance pools.",
  LOG: "Logs (egisops logs): SEVERE ArcGIS Server log entries grouped by source and code.",
  PTL: "Portal health (egisops portal-health): portal machines, licenses, federation and the search index.",
  DST: "Data Store (egisops datastore): ArcGIS Data Store validation, machines, standby and backups.",
  STK: "Stack compatibility (egisops stack-compat): Portal, Server, Data Store, the geodatabase and Pro on releases that belong together.",
  FLT: "Fleet (rdsops fleet): every RDS geodatabase across Regions, posture and Esri compat per instance, and drift across them.",
  BAK: "Site backups (egisops backup-check): the WebGISDR properties file, the newest backup, and the last run.",
};

export const SEVERITY = {
  OK: "The check passed.",
  INFO: "Worth knowing; nothing is wrong yet.",
  WARN: "Something will go wrong if left alone.",
  FAIL: "Something is broken or exposed now.",
};

// ---------------------------------------------------------------- matching

const ESC = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LOOKUP = new Map(); // lowercased phrase -> entry
for (const t of TERMS) {
  for (const p of [t.term, ...(t.also || [])]) LOOKUP.set(p.toLowerCase(), t);
}

// Short all-caps names match case-sensitively so "CA" does not light up in "cache".
const SENSITIVE = (p) => /^[A-Z0-9/_-]{2,5}$/.test(p) || p.startsWith("db.") || p === "SEVERE";

function pattern(phrases) {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  return sorted.map(ESC).join("|");
}

const allPhrases = [...LOOKUP.keys()].map((k) => {
  const entry = LOOKUP.get(k);
  return [entry.term, ...(entry.also || [])].find((p) => p.toLowerCase() === k);
});
const RE_SENSITIVE = new RegExp(`(?<![\\w-])(${pattern(allPhrases.filter(SENSITIVE))})(?![\\w-])`, "g");
const RE_INSENSITIVE = new RegExp(`(?<![\\w-])(${pattern(allPhrases.filter((p) => !SENSITIVE(p)))})(?![\\w-])`, "gi");

export function lookup(phrase) {
  return LOOKUP.get(String(phrase).toLowerCase()) || null;
}

const attr = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Wrap glossary terms in already-escaped HTML text. Only touches text between tags,
// marks each term once per call, and never touches text inside <code> or existing terms.
export function annotate(escapedHtml) {
  const seen = new Set();
  const wrap = (m) => {
    const entry = lookup(m);
    if (!entry || seen.has(entry.term)) return m;
    seen.add(entry.term);
    return `<span class="term" tabindex="0" data-term="${attr(entry.term)}">${m}</span>`;
  };
  let depth = 0; // inside <code> or a term span
  return escapedHtml.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      if (/^<(code|span class="term")/.test(part)) depth++;
      else if (/^<\/(code|span)>/.test(part) && depth) depth--;
      return part;
    }
    if (depth) return part;
    // one combined pass per regex, longest phrase first
    const marks = [];
    for (const re of [RE_SENSITIVE, RE_INSENSITIVE]) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(part));) marks.push([m.index, m[0]]);
    }
    marks.sort((a, b) => a[0] - b[0] || b[1].length - a[1].length);
    let out = "", at = 0;
    for (const [i, text] of marks) {
      if (i < at) continue; // overlaps a longer match already used
      out += part.slice(at, i) + wrap(text);
      at = i + text.length;
    }
    return out + part.slice(at);
  }).join("");
}
