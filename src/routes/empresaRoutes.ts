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

router.use(authenticateJWT);

router.get("/", listEmpresasConDepartamentos);

router.post(
  "/",
  authorizeRoles(Roles.SUPERVISOR_CONTABILIDAD, Roles.GERENCIA),
  createEmpresa
);

router.patch(
  "/:id",
  authorizeRoles(Roles.SUPERVISOR_CONTABILIDAD, Roles.GERENCIA),
  updateEmpresa
);

router.delete(
  "/:id",
  authorizeRoles(Roles.SUPERVISOR_CONTABILIDAD, Roles.GERENCIA),
  deleteEmpresa
);

export default router;
