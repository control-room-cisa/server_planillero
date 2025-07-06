// src/routes/empresaRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { listEmpresasConDepartamentos } from "../controllers/EmpresaController";

const router = Router();

// Protegemos la ruta
router.use(authenticateJWT);

// GET /empresas
router.get("/", listEmpresasConDepartamentos);

export default router;
