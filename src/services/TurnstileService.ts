import { AppError } from "../errors/AppError";

interface TurnstileSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export class TurnstileService {
  static async verify(token: string, remoteIp?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      throw new AppError(
        "Verificación de seguridad no configurada en el servidor",
        500
      );
    }

    if (!token?.trim()) {
      throw new AppError("Debe completar la verificación de seguridad", 400);
    }

    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });

    if (remoteIp) {
      body.set("remoteip", remoteIp);
    }

    let data: TurnstileSiteverifyResponse;
    try {
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );
      data = (await response.json()) as TurnstileSiteverifyResponse;
    } catch {
      throw new AppError(
        "No se pudo validar la verificación de seguridad. Intente de nuevo.",
        502
      );
    }

    if (!data.success) {
      throw new AppError(
        "La verificación de seguridad falló. Intente de nuevo.",
        403
      );
    }
  }
}
