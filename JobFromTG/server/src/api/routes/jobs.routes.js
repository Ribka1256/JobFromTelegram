/**
 * src/api/routes/jobs.routes.js
 * Routes for job-specific endpoints only.
 * Static paths (today, recent) must be declared BEFORE /:id.
 */

import { Router } from "express";
import * as jobsCtrl from "../controllers/jobs.controller.js";

const router = Router();

// GET /api/v1/jobs
router.get("/", jobsCtrl.listJobs);

// GET /api/v1/jobs/today  — static, must precede /:id
router.get("/today", jobsCtrl.listTodayJobs);

// GET /api/v1/jobs/recent — static, must precede /:id
router.get("/recent", jobsCtrl.listRecentJobs);

// GET /api/v1/jobs/week — static, must precede /:id
router.get("/week", jobsCtrl.listWeekJobs);

// GET /api/v1/jobs/:id
router.get("/:id", jobsCtrl.getJob);

export default router;
