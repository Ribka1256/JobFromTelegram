/**
 * src/api/routes/internal.routes.js
 * Internal endpoints called exclusively by the Python scraper.
 * In production, these should be protected by an internal API key
 * or network policy (e.g. not publicly accessible).
 */

import { Router } from "express";
import * as jobsCtrl from "../controllers/jobs.controller.js";
import * as syncCtrl from "../controllers/sync.controller.js";

const router = Router();

// Deduplication data for scraper pre-loading
router.get("/known-links",   jobsCtrl.getKnownLinks);
router.get("/known-hashes",  jobsCtrl.getKnownHashes);
router.get("/recent-texts",  jobsCtrl.getRecentTexts);

// Job ingestion (scraper writes jobs here)
router.post("/jobs",         jobsCtrl.ingestJob);

// Channel management
router.put("/channels/:username", jobsCtrl.upsertChannel);

// Scrape logging
router.post("/scrape-logs",  jobsCtrl.createScrapeLog);

// Full sync: scrape Telegram → import into DB
router.post("/sync",         syncCtrl.startSync);
router.get("/sync/status",   syncCtrl.getSyncStatus);

export default router;
