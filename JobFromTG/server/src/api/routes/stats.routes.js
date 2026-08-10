/**
 * src/api/routes/stats.routes.js
 * Route definitions for statistics endpoints.
 */

import { Router } from "express";
import * as statsCtrl from "../controllers/stats.controller.js";

const router = Router();

// GET /api/v1/stats
router.get("/", statsCtrl.getStats);

// GET /api/v1/stats/categories
router.get("/categories", statsCtrl.getCategoryBreakdown);

// GET /api/v1/stats/employment-types
router.get("/employment-types", statsCtrl.getEmploymentTypeBreakdown);

// GET /api/v1/stats/locations
router.get("/locations", statsCtrl.getTopLocations);

export default router;
