/**
 * src/api/routes/companies.routes.js
 */

import { Router } from "express";
import * as jobsCtrl from "../controllers/jobs.controller.js";

const router = Router();

// GET /api/v1/companies
router.get("/", jobsCtrl.listCompanies);

// GET /api/v1/companies/:id/jobs
router.get("/:id/jobs", jobsCtrl.listCompanyJobs);

export default router;
