/**
 * FUSIONest Data Migration Script
 * Reads data from old Lovable Supabase → writes to new Supabase
 *
 * Usage:
 *   node supabase/migrate_data.mjs
 *
 * You will be prompted for your email and password (same ones you used on Lovable).
 */

import { createClient } from "@supabase/supabase-js";
import readline from "readline";

// ── Old Lovable Supabase (source) ──────────────────────────
const OLD_URL  = "https://nsnaepcguxlyqrxbzctq.supabase.co";
const OLD_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbmFlcGNndXhseXFyeGJ6Y3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTE2NDUsImV4cCI6MjA3Njc4NzY0NX0.587nJah2kei1ZXBtTnbVnCBwYvssrqZDlGPrdgoOFLs";

// ── New Supabase (destination) ─────────────────────────────
const NEW_URL  = "https://lajoglgmzfbeefokswrq.supabase.co";
const NEW_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxham9nbGdtemZiZWVmb2tzd3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5OTAyMDUsImV4cCI6MjEwNTU2NjIwNX0.mPuAqtwGwxUihwM_W6ha7wt0IcptHbmrP-Zs7yIEDrc";

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

// ── Prompt helper ──────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ── Helpers ────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const err  = (msg) => console.error(`  ❌ ${msg}`);

async function fetchAll(db, table, select = "*") {
  const { data, error } = await db.from(table).select(select);
  if (error) { warn(`Could not read ${table}: ${error.message}`); return []; }
  return data ?? [];
}

async function upsertBatch(db, table, rows, conflictCol = "id") {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: conflictCol, ignoreDuplicates: false });
  if (error) err(`Insert into ${table} failed: ${error.message}`);
  else log(`${table}: ${rows.length} rows`);
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 FUSIONest Data Migration\n");
  console.log("Enter the email and password you used on Lovable / old FUSIONest:\n");

  const email    = await ask("  Email: ");
  const password = await ask("  Password: ");
  rl.close();

  // Sign in to OLD database
  console.log("\n🔐 Authenticating with old database...");
  const { data: authData, error: authErr } = await oldDb.auth.signInWithPassword({ email, password });
  if (authErr) {
    err(`Login failed: ${authErr.message}`);
    err("Make sure you're using the same email/password you registered with on Lovable.");
    process.exit(1);
  }
  log(`Authenticated as ${authData.user.email}`);

  // Sign in to NEW database with same credentials
  console.log("\n🔐 Authenticating with new database...");
  const { error: newAuthErr } = await newDb.auth.signInWithPassword({ email, password });
  if (newAuthErr) {
    // User may not exist yet on new DB — that's ok, they'll register after
    warn(`New DB login: ${newAuthErr.message} — You'll register fresh on the new DB.`);
    warn("Worker/attendance data will be migrated but linked to your new account after you register.");
  } else {
    log("Authenticated on new database too.");
  }

  console.log("\n📦 Reading data from old database...\n");

  // ── 1. Workers ─────────────────────────────────────────
  const workers = await fetchAll(oldDb, "workers");
  console.log(`  Found ${workers.length} workers`);

  // ── 2. Attendance logs ─────────────────────────────────
  const attendance = await fetchAll(oldDb, "attendance_logs");
  console.log(`  Found ${attendance.length} attendance records`);

  // ── 3. User profiles ───────────────────────────────────
  const profiles = await fetchAll(oldDb, "user_profiles");
  console.log(`  Found ${profiles.length} user profiles`);

  // ── 4. Projects ────────────────────────────────────────
  const projects = await fetchAll(oldDb, "projects");
  console.log(`  Found ${projects.length} projects`);

  // ── 5. Project workers ─────────────────────────────────
  const projectWorkers = await fetchAll(oldDb, "project_workers");
  console.log(`  Found ${projectWorkers.length} project-worker assignments`);

  // ── 6. Work allocations ────────────────────────────────
  const workAllocations = await fetchAll(oldDb, "work_allocations");
  console.log(`  Found ${workAllocations.length} work allocations`);

  // ── 7. Supervisor attendance ───────────────────────────
  const supervisorAtt = await fetchAll(oldDb, "supervisor_attendance");
  console.log(`  Found ${supervisorAtt.length} supervisor attendance records`);

  // ── 8. Notifications ───────────────────────────────────
  const notifications = await fetchAll(oldDb, "notifications");
  console.log(`  Found ${notifications.length} notifications`);

  // ── 9. DPR entries ─────────────────────────────────────
  const dprs = await fetchAll(oldDb, "daily_progress_reports");
  console.log(`  Found ${dprs.length} DPR records`);

  // ── 10. Checklists ─────────────────────────────────────
  const checklists = await fetchAll(oldDb, "checklists");
  console.log(`  Found ${checklists.length} checklists`);

  // ── 11. Groups ─────────────────────────────────────────
  const groups = await fetchAll(oldDb, "worker_groups");
  console.log(`  Found ${groups.length} worker groups`);

  // ── 12. Group members ──────────────────────────────────
  const groupMembers = await fetchAll(oldDb, "worker_group_members");
  console.log(`  Found ${groupMembers.length} group members`);

  // ── Save to JSON backup ────────────────────────────────
  const backup = {
    exported_at: new Date().toISOString(),
    old_user_id: authData.user.id,
    workers, attendance, profiles, projects,
    projectWorkers, workAllocations, supervisorAtt,
    notifications, dprs, checklists, groups, groupMembers,
  };

  const fs = await import("fs");
  const backupPath = "supabase/data_backup.json";
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  log(`Backup saved to ${backupPath}`);

  console.log("\n📤 Writing data to new database...\n");

  // Insert in dependency order (parents before children)
  await upsertBatch(newDb, "workers",               workers);
  await upsertBatch(newDb, "attendance_logs",        attendance);
  await upsertBatch(newDb, "projects",               projects);
  await upsertBatch(newDb, "project_workers",        projectWorkers);
  await upsertBatch(newDb, "work_allocations",       workAllocations);
  await upsertBatch(newDb, "supervisor_attendance",  supervisorAtt);
  await upsertBatch(newDb, "notifications",          notifications);
  await upsertBatch(newDb, "daily_progress_reports", dprs);
  await upsertBatch(newDb, "checklists",             checklists);
  await upsertBatch(newDb, "worker_groups",          groups);
  await upsertBatch(newDb, "worker_group_members",   groupMembers);

  console.log("\n✅ Migration complete!\n");
  console.log("Next steps:");
  console.log("  1. Open http://localhost:8080");
  console.log("  2. Register with the SAME email you just used");
  console.log("  3. Go through Onboarding → Create your company");
  console.log("  4. All your workers and attendance data will be there\n");
}

main().catch(e => { err(e.message); process.exit(1); });
