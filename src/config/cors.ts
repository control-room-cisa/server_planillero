/**
 * Orígenes CORS permitidos (frontend).
 * Env: CORS_ORIGINS=http://localhost:5173,https://app.ejemplo.com
 */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CORS_ORIGINS no está definido. Configura los orígenes del frontend en .env (separados por coma)."
    );
  }

  // Desarrollo: Vite por defecto
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

export function assertCorsConfigured(): void {
  getCorsOrigins();
}
