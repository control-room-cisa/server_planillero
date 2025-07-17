
import { Router }               from "express";
import { listByDepartment, listByCompany }     from "../controllers/EmpleadoController";
import { authenticateJWT }      from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticateJWT);
router.get("/departamento", listByDepartment);
router.get("/empresa", listByCompany);
export default router;
