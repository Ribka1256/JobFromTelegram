/**
 * src/database/prisma.js
 * Singleton Prisma client — Prisma 7 driver adapter pattern.
 *
 * Prisma 7 removed the built-in query engine and now requires an explicit
 * driver adapter. We use @prisma/adapter-pg backed by a pg connection pool.
 */

import { PrismaClient }  from "../../generated/prisma/index.js";
import { PrismaPg }      from "@prisma/adapter-pg";
import pg                from "pg";
import "dotenv/config";

const { Pool } = pg;

const globalForPrisma = globalThis;

function createPrismaClient() {
  const pool = new Pool({
    connectionString:       process.env.DATABASE_URL,
    max:                    20,    // Up from default 10 — handle migration + read concurrency
    idleTimeoutMillis:      30000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

