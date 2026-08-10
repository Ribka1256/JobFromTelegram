/**
 * src/repositories/channels.repository.js
 * All Prisma queries for the TelegramChannel model.
 */

import { prisma } from "../database/prisma.js";

export async function findAllChannels() {
  return prisma.telegramChannel.findMany({
    where:   { isActive: true },
    orderBy: { username: "asc" },
    select: {
      id: true, username: true, displayName: true,
      isNarrative: true, memberCount: true,
      _count: { select: { jobSources: true } },
    },
  });
}

export async function upsertChannel(data) {
  return prisma.telegramChannel.upsert({
    where:  { username: data.username },
    update: {
      displayName: data.display_name ?? data.displayName,
      isNarrative: data.is_narrative ?? data.isNarrative ?? false,
    },
    create: {
      username:    data.username,
      displayName: data.display_name ?? data.displayName,
      isNarrative: data.is_narrative ?? data.isNarrative ?? false,
    },
  });
}

export async function logScrape(data) {
  const channel = await prisma.telegramChannel.findUnique({
    where: { username: data.channelUsername },
  });
  if (!channel) return;

  return prisma.scrapeLog.create({
    data: {
      channelId:      channel.id,
      status:         data.status       || "SUCCESS",
      messagesScanned:data.messagesScanned || 0,
      jobsFound:      data.jobsFound       || 0,
      jobsInserted:   data.jobsInserted    || 0,
      duplicatesFound:data.duplicatesFound || 0,
      aiCallsMade:    data.aiCallsMade     || 0,
      durationMs:     data.durationMs      || null,
      completedAt:    new Date(),
    },
  });
}
