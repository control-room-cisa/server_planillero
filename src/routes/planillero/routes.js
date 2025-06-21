import express from "express";
import { getCustomerAll, getCustomerJob } from "../../controllers/customerController.js";
import { getDataAllByUser, getTaskDay, savedateDay } from "../../controllers/tareasDiariasControllers.js";

const router = express.Router();

router.get("/customers", getCustomerAll);
router.get("/customers/job", getCustomerJob);

router.get("/data/user/:usuario_id", getDataAllByUser);
router.get("/data/user/:usuario_id/date/:fecha", getTaskDay);
router.get('/data/user/:usuario_id/all', getDataAllByUser);


router.post("/save/data", savedateDay);

export default router;