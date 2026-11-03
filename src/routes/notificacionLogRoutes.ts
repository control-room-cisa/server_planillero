import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import {
  countNoLeidas,
  listMias,
  marcarLeida,
} from "../controllers/NotificacionLogController";
import {
  listNotificacionesSchema,
  notificacionIdParamsSchema,
} from "../validators/notificacionLog.validator";

const router = Router();

router.use(authenticateJWT);

router.get("/mias/pendientes", countNoLeidas);
router.get("/mias", validate(listNotificacionesSchema), listMias);
router.patch(
  "/mias/:id/leida",
  validate(notificacionIdParamsSchema),
  marcarLeida
);

export default router;
