// src/routes/NominaRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  leerNominas,
  crearNomina,
  actualizarNomina,
} from "../controllers/NominaController";
import { Roles } from "../enums/roles";

const router = Router();

// Requiere sesión iniciada
router.use(authenticateJWT);

// Middleware simple de autorización por rol (por ahora solo RRHH)
router.use((req, res, next) => {
  const anyReq: any = req;
  if (anyReq.user?.rolId !== Roles.RRHH) {
    return res
      .status(403)
      .json({ success: false, message: "Solo RRHH", data: null });
  }
  next();
});

// GET /api/nominas
router.get("/", leerNominas);

// POST /api/nominas
router.post("/", crearNomina);

// PUT /api/nominas/:id
router.put("/:id", actualizarNomina);

export default router;
