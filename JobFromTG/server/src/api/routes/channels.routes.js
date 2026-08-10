/**
 * src/api/routes/channels.routes.js
 */

import { Router } from "express";
import * as jobsCtrl from "../controllers/jobs.controller.js";

const router = Router();

// GET /api/v1/channels
router.get("/", jobsCtrl.listChannels);

export default router;
