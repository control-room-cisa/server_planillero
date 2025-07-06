import { Router } from "express";
import { createPlanilla, getAllLatestPlanillas, getLatestPlanillaDetail } from "../controllers/PlanillaController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const planillaRouter = Router();
planillaRouter.use(authenticateJWT); 

planillaRouter.post("/", createPlanilla);
planillaRouter.get("/last", getAllLatestPlanillas);
planillaRouter.get("/last-detail", getLatestPlanillaDetail);


export default planillaRouter;
