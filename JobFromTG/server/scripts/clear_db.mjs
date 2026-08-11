/**
 * scripts/clear_db.mjs
 * Deletes all scraped data from Supabase for a fresh start.
 * Clears: jobs → companies → locations → categories
 * (Channels are preserved — they're config, not data)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function clearAll() {
  console.log("\n🗑  Clearing all data from Supabase…\n");

  // 1. Delete all jobs first (has FK refs to other tables)
  const { data: jobs, error: jobsErr } = await supabase
    .from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  if (jobsErr) { console.error("  ❌ jobs:", jobsErr.message); }
  else console.log(`  ✅ Deleted ${jobs?.length ?? 0} jobs`);

  // 2. Companies
  const { data: cos, error: cosErr } = await supabase
    .from("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  if (cosErr) console.error("  ❌ companies:", cosErr.message);
  else console.log(`  ✅ Deleted ${cos?.length ?? 0} companies`);

  // 3. Locations
  const { data: locs, error: locsErr } = await supabase
    .from("locations").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  if (locsErr) console.error("  ❌ locations:", locsErr.message);
  else console.log(`  ✅ Deleted ${locs?.length ?? 0} locations`);

  // 4. Categories
  const { data: cats, error: catsErr } = await supabase
    .from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  if (catsErr) console.error("  ❌ categories:", catsErr.message);
  else console.log(`  ✅ Deleted ${cats?.length ?? 0} categories`);

  console.log("\n✅ Database cleared! Ready for a fresh import.\n");
}

clearAll().catch(err => { console.error(err); process.exit(1); });
