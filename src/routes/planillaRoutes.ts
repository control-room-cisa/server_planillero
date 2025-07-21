import { Router } from "express";
import {
  createPlanilla,
  getAllLatestPlanillas,
  getPlanillaDepartamentoDetalle,
} from "../controllers/PlanillaController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const planillaRouter = Router();
planillaRouter.use(authenticateJWT);

planillaRouter.post("/", createPlanilla);
planillaRouter.get("/last", getAllLatestPlanillas);

planillaRouter.get("/detalle/:empleadoId", getPlanillaDepartamentoDetalle);

export default planillaRouter;
