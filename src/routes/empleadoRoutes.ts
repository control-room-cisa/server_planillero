import { Router } from "express";
import {
  listByDepartment,
  listByCompany,
  createEmpleado,
  updateEmpleado,
} from "../controllers/EmpleadoController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticateJWT);
router.get("/departamento", listByDepartment);
router.get("/empresa", listByCompany);
router.post("/", createEmpleado);
router.patch("/", updateEmpleado);
export default router;
