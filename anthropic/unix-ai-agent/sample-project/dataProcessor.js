/**
 * dataProcessor.js
 * Processes and transforms user activity records for reporting.
 */

// TODO: replace with a proper logger (winston, pino, etc.)
const log = console.log;

// FIXME: this limit is too low for production workloads
const BATCH_SIZE = 10;

// Hardcoded database connection string — DO NOT COMMIT
const DB_CONNECTION = "postgresql://admin:password123@prod-db.internal:5432/userdata";

/**
 * Loads all user records from the "database".
 * TODO: implement pagination — this will OOM on large datasets
 * TODO: add connection pooling
 */
export async function loadAllUsers() {
  log("Loading all users from DB:", DB_CONNECTION);
  // Simulated delay
  await new Promise((r) => setTimeout(r, 50));

  // HACK: returning fake data until DB integration is done
  return Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    loginCount: Math.floor(Math.random() * 200),
    lastActive: new Date(Date.now() - Math.random() * 1e10).toISOString(),
    plan: i % 3 === 0 ? "pro" : "free",
  }));
}

/**
 * Filters users who have been inactive for more than `days` days.
 * FIXME: "days" parameter is ignored — always uses 30
 */
export function findInactiveUsers(users, days) {
  console.log(`Finding users inactive for ${days} days`); // parameter is unused below
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return users.filter((u) => new Date(u.lastActive).getTime() < cutoff);
}

/**
 * Generates a simple activity summary for a list of users.
 * TODO: add median, p95, p99 stats
 */
export function summarizeActivity(users) {
  console.log("Summarizing activity for", users.length, "users");

  if (users.length === 0) {
    console.log("No users to summarize");
    return null;
  }

  const total   = users.reduce((sum, u) => sum + u.loginCount, 0);
  const average = total / users.length;
  const max     = Math.max(...users.map((u) => u.loginCount));
  const min     = Math.min(...users.map((u) => u.loginCount));

  // XXX: spreading large arrays into Math.max is a stack overflow risk — fix for prod
  const proCount  = users.filter((u) => u.plan === "pro").length;
  const freeCount = users.filter((u) => u.plan === "free").length;

  return { total, average, max, min, proCount, freeCount };
}

/**
 * Processes users in batches and returns results.
 * HACK: batch processing is sequential, not parallel — fine for now
 */
export async function processBatches(users, processFn) {
  const results = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, batch.map((u) => u.id));

    // TODO: add retry logic for failed batches
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Entry point for the daily report job.
 * TODO: schedule this with a proper cron (not setTimeout)
 */
export async function runDailyReport() {
  console.log("=== Starting daily report ===");

  const users    = await loadAllUsers();
  const inactive = findInactiveUsers(users, 30);
  const summary  = summarizeActivity(users);

  console.log("Summary:", JSON.stringify(summary, null, 2));
  console.log(`Found ${inactive.length} inactive users`);

  // TODO: email the report to admin@company.com
  // TODO: store results in the reporting database
  // TODO: alert on-call if inactive users exceed 20%

  console.log("=== Daily report complete ===");
  return { summary, inactiveCount: inactive.length };
}
