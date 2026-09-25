import { Router, Request, Response } from "express";
import { AuthController } from "../controllers/AuthController";
import { validate } from "../middlewares/validate";
import { loginSchema } from "../validators/auth.validator";
import { ApiResponse } from "../dtos/ApiResponse";
import { loginRateLimiter } from "../middlewares/loginRateLimiter";

export const authRouter = Router();

/** Endpoints deshabilitados: el alta de usuarios es solo vía RRHH. */
authRouter.post("/register", (_req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    message:
      "El registro público está deshabilitado. Contacte a recursos humanos.",
    data: null,
  } as ApiResponse<null>);
});

authRouter.post(
  "/login",
  loginRateLimiter,
  validate(loginSchema),
  AuthController.login
);

/** Cambio de contraseña deshabilitado temporalmente (no expuesto en UI). */
authRouter.post("/change-password", (_req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    message:
      "El cambio de contraseña está deshabilitado temporalmente. Contacte a recursos humanos.",
    data: null,
  } as ApiResponse<null>);
});
