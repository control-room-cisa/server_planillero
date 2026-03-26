import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listGlobalConfig,
  getGlobalConfig,
  upsertGlobalConfig,
  deleteGlobalConfig,
} from "../controllers/GlobalConfigController";

const router = Router();

router.use(authenticateJWT);
// Por ahora, solo RRHH puede ver/editar configuración global
router.use(authorizeRoles(Roles.RRHH));

// GET /api/global-config
router.get("/", listGlobalConfig);
// GET /api/global-config/:key
router.get("/:key", getGlobalConfig);
// POST /api/global-config (upsert)
router.post("/", upsertGlobalConfig);
// DELETE /api/global-config/:key
router.delete("/:key", deleteGlobalConfig);

export default router;

