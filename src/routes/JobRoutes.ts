import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { listJobs } from "../controllers/JobController";

const router = Router();
router.use(authenticateJWT);

router.get("/", listJobs);

export default router;
