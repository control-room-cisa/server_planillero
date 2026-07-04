import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listTechosIhss,
  createTechoIhss,
  updateTechoIhss,
  deleteTechoIhss,
} from "../controllers/TechoIhssController";

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles(Roles.RRHH));

router.get("/", listTechosIhss);
router.post("/", createTechoIhss);
router.put("/:id", updateTechoIhss);
router.delete("/:id", deleteTechoIhss);

export default router;
