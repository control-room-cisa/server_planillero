// src/validators/feriado.validator.ts
import { z } from "zod";

export const createFeriadoSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(45, "El nombre no puede tener más de 45 caracteres"),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de fecha debe ser YYYY-MM-DD"),
});

export type CreateFeriadoDto = z.infer<typeof createFeriadoSchema>;
