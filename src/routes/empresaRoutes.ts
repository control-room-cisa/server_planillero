// src/routes/empresaRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listEmpresasConDepartamentos,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
} from "../controllers/EmpresaController";

const router = Router();

// GET /empresas - Público (sin autenticación)
router.get("/", listEmpresasConDepartamentos);

// Rutas protegidas: requieren autenticación y roles CONTABILIDAD o GERENCIA
router.post(
  "/",
  authenticateJWT,
  authorizeRoles(Roles.CONTABILIDAD, Roles.GERENCIA),
  createEmpresa
);

router.patch(
  "/:id",
  authenticateJWT,
  authorizeRoles(Roles.CONTABILIDAD, Roles.GERENCIA),
  updateEmpresa
);

router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles(Roles.CONTABILIDAD, Roles.GERENCIA),
  deleteEmpresa
);

export default router;
