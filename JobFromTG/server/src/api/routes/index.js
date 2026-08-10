/**
 * src/api/routes/index.js
 * Root router — mounts all sub-routers under /api/v1.
 * Each resource has its own dedicated router to prevent path conflicts.
 */

import { Router }   from "express";
import jobsRouter      from "./jobs.routes.js";
import companiesRouter from "./companies.routes.js";
import channelsRouter  from "./channels.routes.js";
import statsRouter     from "./stats.routes.js";
import internalRouter  from "./internal.routes.js";

const router = Router();

router.use("/jobs",      jobsRouter);
router.use("/companies", companiesRouter);
router.use("/channels",  channelsRouter);
router.use("/stats",     statsRouter);
router.use("/internal",  internalRouter);

export default router;
