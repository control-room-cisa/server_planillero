import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listRangosFechasAlimentacion,
  createRangoFechasAlimentacion,
  updateRangoFechasAlimentacion,
} from "../controllers/RangosFechasAlimentacionController";

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles(Roles.RRHH));

// Listado por código (query) antes de rutas con :id
router.get("/", listRangosFechasAlimentacion);
router.post("/", createRangoFechasAlimentacion);
router.put("/:id", updateRangoFechasAlimentacion);

export default router;
