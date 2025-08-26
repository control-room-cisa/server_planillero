// src/validators/job.validator.ts
import { z } from "zod";

// Solo números, opcionalmente . + 1-2 decimales (ej: 103, 101.2, 101.23)
const jobCodeRegex = /^\d+(\.\d{1,2})?$/;

export const createJobSchema = z.object({
  codigo: z
    .string()
    .min(1, "El código es requerido")
    .max(10, "Máximo 10 caracteres")
    .regex(
      jobCodeRegex,
      "El código debe ser numérico entero o con hasta 2 decimales (ej: 103 o 101.23)"
    ),
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(45, "Máximo 45 caracteres"),
  descripcion: z.string().max(500).optional(),
  activo: z.boolean().optional(),
  especial: z.boolean().optional(),
  empresaId: z.number().int().positive("empresaId es requerido"),
  mostrarEmpresaId: z.number().int().positive("mostrarEmpresaId es requerido"),
});

export type CreateJobDto = z.infer<typeof createJobSchema>;

// Para update: todos opcionales (pero si envías relaciones deben ser válidas)
export const updateJobSchema = createJobSchema.partial();
export type UpdateJobDto = z.infer<typeof updateJobSchema>;
