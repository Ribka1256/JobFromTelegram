/**
 * server.js
 * HTTP server entrypoint.
 * Imports the app factory and binds it to a port.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 * Last updated: 2026-08-17 (findWeekJobs now excludes today)
 */

import { createApp      } from "./app.js";
import { config         } from "./src/config/index.js";
import { prisma         } from "./src/database/prisma.js";
import { startScheduler } from "./scheduler.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`\n✅ JobFeed API v2 running`);
  console.log(`   http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}\n`);
  startScheduler();
});

// ── Graceful shutdown ──────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[Server] Prisma disconnected. Bye.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled Promise Rejection:", reason);
});