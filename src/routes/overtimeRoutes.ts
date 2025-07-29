import { Router } from 'express';
import { calculateSummaryPeriod } from '../controllers/OvertimeController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();
router.use(authenticateJWT);

router.get('/summary', calculateSummaryPeriod);

export default router;
