/**
 * JWT secret obligatorio. Sin fallback hardcodeado.
 * Debe llamarse después de cargar dotenv (ver loadEnv / index).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está definido. Configúralo en el archivo .env antes de iniciar el servidor."
    );
  }
  return secret;
}

/** Valida al arranque; aborta el proceso si falta el secreto. */
export function assertJwtSecretConfigured(): void {
  getJwtSecret();
}
