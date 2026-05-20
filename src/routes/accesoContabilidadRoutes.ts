import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listAccesosContabilidad,
  getAccesoContabilidad,
  createAccesoContabilidad,
  updateAccesoContabilidad,
  deleteAccesoContabilidad,
  getAccesosContabilidadCatalogos,
} from "../controllers/AccesoContabilidadController";

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles(Roles.SUPERVISOR_CONTABILIDAD));

router.get("/catalogos", getAccesosContabilidadCatalogos);
router.get("/", listAccesosContabilidad);
router.get("/:id", getAccesoContabilidad);
router.post("/", createAccesoContabilidad);
router.put("/:id", updateAccesoContabilidad);
router.delete("/:id", deleteAccesoContabilidad);

export default router;
