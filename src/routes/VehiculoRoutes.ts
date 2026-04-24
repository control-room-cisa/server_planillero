import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { listVehiculos } from "../controllers/VehiculoController";

const router = Router();

router.use(authenticateJWT);
router.get("/", listVehiculos);

export default router;
