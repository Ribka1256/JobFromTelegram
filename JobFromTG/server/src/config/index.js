/**
 * src/config/index.js
 * Centralized, validated config loaded from environment variables.
 * Fails fast at startup if required env vars are missing.
 */

import "dotenv/config";

function require_env(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  // Server
  port:     parseInt(process.env.PORT || "5000", 10),
  nodeEnv:  process.env.NODE_ENV || "development",
  isDev:    (process.env.NODE_ENV || "development") === "development",

  // Database
  databaseUrl: require_env("DATABASE_URL"),

  // Supabase
  // Priority: SUPABASE_URL (production/CI) → VITE_SUPABASE_URL (local dev)
  supabaseUrl:     process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,

  // Cerebras
  cerebrasApiKey: process.env.CEREBRAS_API_KEY,

  // Pagination defaults
  pagination: {
    defaultLimit: 30,
    maxLimit:     100,
  },
};
