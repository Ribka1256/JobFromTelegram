/**
 * src/database/supabase.js
 * Supabase JS client — communicates over HTTPS (port 443).
 * Used as a fallback when direct PostgreSQL TCP (port 5432/6543)
 * is blocked by the local network/firewall.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db:   { schema: "public" },
  }
);
