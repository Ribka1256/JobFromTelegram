/**
 * src/repositories/channels.repository.js
 * Uses @supabase/supabase-js (HTTPS) instead of Prisma (TCP).
 */

import { supabase } from "../database/supabase.js";

function assertOk({ error }, label) {
  if (error) throw new Error(`[${label}] ${error.message}`);
}

export async function findAllChannels() {
  const { data, error } = await supabase
    .from("telegram_channels")
    .select("id, username, displayName, isNarrative, memberCount")
    .eq("isActive", true)
    .order("username", { ascending: true });
  assertOk({ error }, "findAllChannels");
  return data || [];
}

export async function upsertChannel(data) {
  const { data: ch, error } = await supabase
    .from("telegram_channels")
    .upsert({
      username:    data.username,
      displayName: data.display_name ?? data.displayName ?? null,
      isNarrative: data.is_narrative ?? data.isNarrative ?? false,
    }, { onConflict: "username" })
    .select("id, username, displayName, isNarrative")
    .single();
  assertOk({ error }, "upsertChannel");
  return ch;
}

export async function logScrape(data) {
  // Find channel
  const { data: ch } = await supabase
    .from("telegram_channels")
    .select("id")
    .eq("username", data.channelUsername)
    .single();
  if (!ch) return;

  const { error } = await supabase.from("scrape_logs").insert({
    channelId:       ch.id,
    status:          data.status         || "SUCCESS",
    messagesScanned: data.messagesScanned || 0,
    jobsFound:       data.jobsFound       || 0,
    jobsInserted:    data.jobsInserted    || 0,
    duplicatesFound: data.duplicatesFound || 0,
    aiCallsMade:     data.aiCallsMade     || 0,
    durationMs:      data.durationMs      || null,
    completedAt:     new Date().toISOString(),
  });
  assertOk({ error }, "logScrape");
}
