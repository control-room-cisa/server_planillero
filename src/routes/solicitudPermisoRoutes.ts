import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validate } from "../middlewares/validate";
import { Roles } from "../enums/roles";
import {
  calendarioDiaSchema,
  calendarioSchema,
  createSolicitudPermisoSchema,
  decisionSolicitudSchema,
  listDiasSchema,
  listPropiasSchema,
  listRrhhSchema,
  listSupervisionSchema,
  solicitudIdParamsSchema,
  updateSolicitudPermisoSchema,
} from "../validators/solicitudPermiso.validator";
import {
  calendarioSupervision,
  createPropia,
  decidirRrhh,
  decidirSupervision,
  deletePropia,
  getPropia,
  getRrhh,
  getSupervision,
  listDiasPropios,
  listDiasRrhh,
  listDiasSupervision,
  listPropias,
  listRrhh,
  listSupervision,
  ocupacionDiaSupervision,
  pendientesRrhh,
  pendientesSupervision,
  updatePropia,
} from "../controllers/SolicitudPermisoController";

const router = Router();

router.use(authenticateJWT);

router.get(
  "/mias",
  authorizeRoles(Roles.EMPLEADO),
  validate(listPropiasSchema),
  listPropias
);
router.post(
  "/mias",
  authorizeRoles(Roles.EMPLEADO),
  validate(createSolicitudPermisoSchema),
  createPropia
);
router.get(
  "/mias/:id/dias",
  authorizeRoles(Roles.EMPLEADO),
  validate(listDiasSchema),
  listDiasPropios
);
router.get(
  "/mias/:id",
  authorizeRoles(Roles.EMPLEADO),
  validate(solicitudIdParamsSchema),
  getPropia
);
router.patch(
  "/mias/:id",
  authorizeRoles(Roles.EMPLEADO),
  validate(updateSolicitudPermisoSchema),
  updatePropia
);
router.delete(
  "/mias/:id",
  authorizeRoles(Roles.EMPLEADO),
  validate(solicitudIdParamsSchema),
  deletePropia
);

router.get(
  "/supervision/calendario/dia",
  authorizeRoles(Roles.SUPERVISOR),
  validate(calendarioDiaSchema),
  ocupacionDiaSupervision
);
router.get(
  "/supervision/calendario",
  authorizeRoles(Roles.SUPERVISOR),
  validate(calendarioSchema),
  calendarioSupervision
);
router.get(
  "/supervision/pendientes",
  authorizeRoles(Roles.SUPERVISOR),
  pendientesSupervision
);
router.get(
  "/supervision",
  authorizeRoles(Roles.SUPERVISOR),
  validate(listSupervisionSchema),
  listSupervision
);
router.get(
  "/supervision/:id/dias",
  authorizeRoles(Roles.SUPERVISOR),
  validate(listDiasSchema),
  listDiasSupervision
);
router.patch(
  "/supervision/:id/decision",
  authorizeRoles(Roles.SUPERVISOR),
  validate(decisionSolicitudSchema),
  decidirSupervision
);
router.get(
  "/supervision/:id",
  authorizeRoles(Roles.SUPERVISOR),
  validate(solicitudIdParamsSchema),
  getSupervision
);

router.get(
  "/rrhh/pendientes",
  authorizeRoles(Roles.RRHH),
  pendientesRrhh
);
router.get(
  "/rrhh",
  authorizeRoles(Roles.RRHH),
  validate(listRrhhSchema),
  listRrhh
);
router.get(
  "/rrhh/:id/dias",
  authorizeRoles(Roles.RRHH),
  validate(listDiasSchema),
  listDiasRrhh
);
router.patch(
  "/rrhh/:id/decision",
  authorizeRoles(Roles.RRHH),
  validate(decisionSolicitudSchema),
  decidirRrhh
);
router.get(
  "/rrhh/:id",
  authorizeRoles(Roles.RRHH),
  validate(solicitudIdParamsSchema),
  getRrhh
);

export default router;
