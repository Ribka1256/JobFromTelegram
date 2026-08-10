/**
 * app.js
 * Express application factory.
 * Separated from server.js so the app can be imported in tests
 * without starting the HTTP server.
 */

import express   from "express";
import cors      from "cors";
import "dotenv/config";

import { requestLogger } from "./src/api/middleware/requestLogger.js";
import { errorHandler  } from "./src/api/middleware/errorHandler.js";
import apiRouter         from "./src/api/routes/index.js";

export function createApp() {
  const app = express();

  // ── Global middleware ──────────────────────────────────────
  app.use(cors({
    origin:  process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }));
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);

  // ── Health check ──────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
  });

  // ── Backward-compat redirect: old /jobs → new /api/v1/jobs ─
  // Preserves existing frontend calls during the v1 → v2 transition
  app.get("/jobs", (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    res.redirect(301, `/api/v1/jobs${qs ? "?" + qs : ""}`);
  });

  // ── API v1 ────────────────────────────────────────────────
  app.use("/api/v1", apiRouter);

  // ── 404 handler ──────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });

  // ── Global error handler (must be last) ──────────────────
  app.use(errorHandler);

  return app;
}
