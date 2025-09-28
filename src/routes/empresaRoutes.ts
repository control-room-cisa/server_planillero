// src/routes/empresaRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  listEmpresasConDepartamentos,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
} from "../controllers/EmpresaController";

const router = Router();

// Protegemos la ruta
//router.use(authenticateJWT);

// GET /empresas
router.get("/", listEmpresasConDepartamentos);

// POST /empresas
router.post("/", createEmpresa);

// PATCH /empresas/:id
router.patch("/:id", updateEmpresa);

// DELETE /empresas/:id
router.delete("/:id", deleteEmpresa);

export default router;
