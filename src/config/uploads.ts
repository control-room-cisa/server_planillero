// src/config/uploads.ts
export const UPLOADS_PUBLIC_BASE = "/uploads"; // servido estático por Express
export const EMP_BASE_DIR = "empleados";
export const FOTO_DIR = "foto";
export const CV_DIR = "cv";

// Si quieres URL absoluta en la respuesta:
export const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000"; // URL del backend
