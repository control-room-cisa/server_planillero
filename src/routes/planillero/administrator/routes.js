import express from "express";
import { getEmployeesByCompany } from "../../../controllers/administrator/employeesByCompany.js";

const router = express.Router();

router.get("/empleados/:empresa", getEmployeesByCompany);

export default router;
