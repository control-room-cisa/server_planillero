import rateLimit from "express-rate-limit";

/** Límite de intentos de login por IP (fuerza bruta / credential stuffing). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.",
    data: null,
  },
});
