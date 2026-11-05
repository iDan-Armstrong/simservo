// 100 levels in ten tiers. Tier 1 is playable now; later tiers are laid out with their
// subject and titles so the path is visible, and fill in as the real tools behind them
// are built (each tier maps to a real admin tool).

export const TIERS = [
  { tier: 1, name: "Fundamentals", subject: "Your first RDS geodatabase", tool: "rdsops inventory, health, maintenance", status: "playable" },
  { tier: 2, name: "Monitoring and Maintenance", subject: "Keeping the database healthy week to week", tool: "rdsops health, maintenance", status: "playable" },
  { tier: 3, name: "Versions and Upgrades", subject: "Esri support matrix, minor patches, blue/green majors, ArcGIS Enterprise upgrades", tool: "rdsops compat, egisops stack-compat (Expansion 1)", status: "playable" },
  { tier: 4, name: "Backup and Restore", subject: "Snapshots, point-in-time restore, timed drills, WebGISDR", tool: "rdsops restore-drill, egisops backup-check", status: "playable" },
  { tier: 5, name: "ArcGIS Server", subject: "Sites, services, pools, logs", tool: "egisops server-health", status: "playable" },
  { tier: 6, name: "Portal and Federation", subject: "Portal for ArcGIS, federation, licenses, search", tool: "egisops portal-health", status: "playable" },
  { tier: 7, name: "Data Store and Geodatabases", subject: "ArcGIS Data Store, standby, backups", tool: "egisops datastore", status: "playable" },
  { tier: 8, name: "Security Operations", subject: "Hardening, attacks and incident response playbooks", tool: "rdsops security, incident; egisops security, incident", status: "playable" },
  { tier: 9, name: "High Availability and DR", subject: "Multi-AZ, cross-region copies, failover drills", tool: "planned", status: "planned" },
  { tier: 10, name: "Fleet Command", subject: "Many sites, one operations center", tool: "rdsops fleet, aurora-plan (Expansion 2)", status: "playable" },
];

const TITLES = [
  // tier 1
  "Night Shift Intern", "Console Watcher", "Ticket Taker", "Index Apprentice", "Vacuum Operator",
  "Backup Keeper", "Patch Wrangler", "On-Call Junior", "Incident Responder", "Tier One Operator",
  // tier 2
  "Metrics Reader", "Bloat Hunter", "Stats Keeper", "Lock Breaker", "Slot Sweeper",
  "Storage Steward", "Query Tracker", "Autovacuum Tuner", "Wraparound Warden", "Maintenance Lead",
  // tier 3
  "Release Reader", "Matrix Checker", "Minor Patcher", "Extension Minder", "Window Planner",
  "Blue Builder", "Green Validator", "Switchover Pilot", "Rollback Planner", "Upgrade Captain",
  // tier 4
  "Snapshot Taker", "Retention Planner", "PITR Practitioner", "Drill Runner", "Timer Beater",
  "Copy Courier", "Restore Verifier", "Runbook Writer", "Recovery Engineer", "Restore Captain",
  // tier 5
  "Site Visitor", "Service Starter", "Pool Tuner", "Log Reader", "Machine Adder",
  "Cluster Keeper", "Cache Builder", "Publisher", "Server Steward", "Server Admin",
  // tier 6
  "Portal Greeter", "Group Gardener", "Role Assigner", "Federation Apprentice", "Identity Linker",
  "SAML Wrangler", "Content Curator", "License Juggler", "Webhook Wiring", "Portal Admin",
  // tier 7
  "Data Store Keeper", "Relational Steward", "Tile Cache Tender", "Version Manager", "Reconcile Runner",
  "Compress Scheduler", "Replica Minder", "Schema Guardian", "Archive Keeper", "Geodatabase Admin",
  // tier 8
  "Badge Checker", "Key Rotator", "Audit Reader", "Cert Renewer", "Exposure Hunter",
  "Least Privilege", "Secret Keeper", "Patch Enforcer", "Threat Spotter", "Security Lead",
  // tier 9
  "Standby Builder", "Failover Tester", "Region Planner", "Copy Shipper", "Chaos Practitioner",
  "RTO Breaker", "RPO Keeper", "DR Rehearser", "Resilience Engineer", "Continuity Chief",
  // tier 10
  "Second Site", "Fleet Watcher", "Standards Setter", "Automation Builder", "Cost Captain",
  "Fleet Patcher", "Ops Mentor", "Platform Owner", "Operations Director", "Trollzilla Tamer",
];

// Cumulative XP needed to reach a level. Level 2 at 60 XP; level 10 near 3,100;
// level 100 near 520,000. Steep enough that later tiers take real play.
export function xpForLevel(n) {
  if (n <= 1) return 0;
  return Math.round(60 * Math.pow(n - 1, 1.95));
}

export function levelForXp(xp) {
  let n = 1;
  while (n < 100 && xp >= xpForLevel(n + 1)) n++;
  return n;
}

// What each playable level adds. Tutorials keyed here explain the addition.
const UNLOCKS = {
  1: ["Inventory scan (rdsops inventory)"],
  2: ["Health scan (rdsops health)", "Upgrade shop"],
  3: ["Maintenance scan (rdsops maintenance)", "Random scenarios"],
  4: ["ArcGIS Server health scan (egisops server-health)", "More scenarios: slots, duplicates, public access, server outages"],
  5: ["ArcGIS Server services and logs (egisops services, logs)", "Multi-AZ and scaling in the shop", "Availability Zone outages"],
  6: ["Restore drills (rdsops restore-drill)", "Accidents that need a restore", "Audits"],
  7: ["Compatibility scan (rdsops compat)", "Patch-window scenarios"],
  8: ["Production mode: availability gaps become failures", "Transaction ID wraparound scenarios"],
  9: ["Portal for ArcGIS health scan (egisops portal-health)", "Second portal machine in the shop", "Faster scenario rate"],
  10: ["ArcGIS Data Store validation (egisops datastore)", "Data Store standby machine in the shop", "Rare events. Something large is out there."],
  11: ["Site backups with WebGISDR (egisops backup-check)", "S3 backup storage in the shop"],
  12: ["Expansion: The 12.1 Upgrade", "Stack compatibility (egisops stack-compat) replaces the planning-only compat scan"],
  14: ["Expansion 2: The Takeover (after the 12.1 Upgrade)", "A client in AWS GovCloud (US)", "Aurora migration planning (rdsops aurora-plan)"],
  15: ["Security Operations: rdsops security and egisops security score your posture", "Attacks, drawn by what you leave open", "Incident response with the real rdsops and egisops playbooks", "Federal clients: the CISA one-hour report"],
  31: ["Snapshot-mode drills", "Tighter recovery target: 30 minutes"],
  41: ["A second ArcGIS Server machine joins the site", "Certificate and license renewals on a schedule"],
};

export const LEVELS = Array.from({ length: 100 }, (_, i) => {
  const n = i + 1;
  const tier = TIERS[Math.floor(i / 10)];
  return {
    n,
    title: TITLES[i],
    tier: tier.tier,
    tierName: tier.name,
    xp: xpForLevel(n),
    playable: tier.status === "playable",
    unlocks: UNLOCKS[n] || [],
    tutorial: UNLOCKS[n] ? `level-${n}` : null,
  };
});

export function features(level) {
  return {
    inventory: level >= 1,
    health: level >= 2,
    shop: level >= 2,
    maintenance: level >= 3,
    scenarios: level >= 3,
    compat: level >= 7,
    server: level >= 4,
    portal: level >= 9,
    datastore: level >= 10,
    backups: level >= 11,
    stack: level >= 12,
    services: level >= 5,
    secondMachine: level >= 41,
    drills: level >= 6,
    snapshotDrills: level >= 31,
    production: level >= 8,
    scenarioRate: level >= 9 ? 0.12 : 0.09,
  };
}
