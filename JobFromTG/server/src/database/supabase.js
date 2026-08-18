/**
 * src/database/supabase.js
 * Supabase JS client — communicates over HTTPS (port 443).
 * Used as a fallback when direct PostgreSQL TCP (port 5432/6543)
 * is blocked by the local network/firewall.
 *
 * Env var priority:
 *   SUPABASE_URL       → production / CI (GitHub Actions, Render)
 *   VITE_SUPABASE_URL  → local dev (Vite exposes VITE_* vars to frontend,
 *                        but the server .env also sets it)
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

export const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db:   { schema: "public" },
  }
);
