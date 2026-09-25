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

router.use(authenticateJWT);

router.get("/", listDepartamentos);

router.get("/:id", getDepartamento);

router.post(
  "/",
  authorizeRoles(Roles.RRHH),
  validate(createDepartamentoSchema),
  createDepartamento
);

router.put(
  "/:id",
  authorizeRoles(Roles.RRHH),
  validate(updateDepartamentoSchema),
  updateDepartamento
);

router.delete(
  "/:id",
  authorizeRoles(Roles.RRHH),
  deleteDepartamento
);

export default router;
