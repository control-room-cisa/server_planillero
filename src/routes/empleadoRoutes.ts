import { Router } from "express";
import {
  listByDepartment,
  listByCompany,
  createEmpleado,
  updateEmpleado,
} from "../controllers/EmpleadoController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { uploadEmpleado } from "../middlewares/upload";

const router = Router();
router.use(authenticateJWT);
router.get("/departamento", listByDepartment);
router.get("/empresa", listByCompany);
router.post("/", uploadEmpleado, createEmpleado);
router.patch("/", uploadEmpleado, updateEmpleado);
export default router;
