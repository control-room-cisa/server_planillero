
import { Router }               from "express";
import { listByDepartment }     from "../controllers/EmpleadoController";
import { authenticateJWT }      from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticateJWT);
router.get("/", listByDepartment);
export default router;
