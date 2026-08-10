// prisma.config.ts
// Prisma 7 configuration — connection URLs live here, not in schema.prisma.
// See: https://pris.ly/d/config-datasource

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Pooler URL — used by Prisma Client at runtime (pgbouncer compatible)
    url: process.env["DATABASE_URL"]!,
    // Direct URL — used by Prisma Migrate (bypasses pgbouncer)
    directUrl: process.env["DIRECT_URL"],
  },
});
