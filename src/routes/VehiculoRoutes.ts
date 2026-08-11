import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import { validate } from "../middlewares/validate";
import {
  createVehiculoSchema,
  updateVehiculoSchema,
} from "../validators/vehiculo.validator";
import {
  listVehiculos,
  getVehiculo,
  createVehiculo,
  updateVehiculo,
  deleteVehiculo,
} from "../controllers/VehiculoController";

const router = Router();

router.use(authenticateJWT);

// GET /api/vehiculos - Autenticados (usado también por registro de actividades)
router.get("/", listVehiculos);

// GET /api/vehiculos/:id
router.get("/:id", getVehiculo);

// POST /api/vehiculos - Solo Logística
router.post(
  "/",
  authorizeRoles(Roles.LOGISTICA),
  validate(createVehiculoSchema),
  createVehiculo
);

// PUT /api/vehiculos/:id - Solo Logística
router.put(
  "/:id",
  authorizeRoles(Roles.LOGISTICA),
  validate(updateVehiculoSchema),
  updateVehiculo
);

// DELETE /api/vehiculos/:id - Solo Logística
router.delete("/:id", authorizeRoles(Roles.LOGISTICA), deleteVehiculo);

export default router;
