import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/** Extrae el identificador de login del body (mismo criterio que AuthController). */
function loginIdentifierFromBody(req: Request): string {
  const body = req.body ?? {};
  const raw = [body.identificador, body.usuario, body.correoElectronico, body.dni].find(
    (v) => typeof v === "string" && v.trim().length > 0
  );
  return typeof raw === "string" ? raw.trim().toLowerCase() : "unknown";
}

/** Límite de intentos de login por usuario+IP (fuerza bruta / credential stuffing). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userKey = loginIdentifierFromBody(req);
    const ipKey = ipKeyGenerator(req.ip ?? "");
    return `${userKey}:${ipKey}`;
  },
  message: {
    success: false,
    message:
      "Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.",
    data: null,
  },
});
