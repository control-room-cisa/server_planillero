import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { validate } from "../middlewares/validate";
import { registerSchema, loginSchema } from "../validators/auth.validator";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), AuthController.register);

authRouter.post("/login", validate(loginSchema), AuthController.login);
