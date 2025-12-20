// src/routes/departamentoRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listDepartamentos,
  getDepartamento,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
} from "../controllers/DepartamentoController";
import { validate } from "../middlewares/validate";
import {
  createDepartamentoSchema,
  updateDepartamentoSchema,
} from "../validators/departamento.validator";

const router = Router();

// GET /api/departamentos?empresaId=... - Público (sin autenticación)
router.get("/", listDepartamentos);

// GET /api/departamentos/:id - Público (sin autenticación)
router.get("/:id", getDepartamento);

// POST /api/departamentos - Solo RRHH
router.post(
  "/",
  authenticateJWT,
  authorizeRoles(Roles.RRHH),
  validate(createDepartamentoSchema),
  createDepartamento
);

// PUT /api/departamentos/:id - Solo RRHH
router.put(
  "/:id",
  authenticateJWT,
  authorizeRoles(Roles.RRHH),
  validate(updateDepartamentoSchema),
  updateDepartamento
);

// DELETE /api/departamentos/:id - Solo RRHH
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles(Roles.RRHH),
  deleteDepartamento
);

export default router;

