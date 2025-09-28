// src/validators/job.validator.ts
import { z } from "zod";

// Estructura jerárquica: NNNN.NNNN.NNNN (máximo 4 dígitos por número, máximo 2 puntos)
const jobCodeRegex = /^(\d{1,4})(\.\d{1,4})?(\.\d{1,4})?$/;

export const createJobSchema = z.object({
  codigo: z
    .string()
    .min(1, "El código es requerido")
    .max(20, "Máximo 20 caracteres")
    .regex(
      jobCodeRegex,
      "El código debe seguir el formato: NNNN.NNNN.NNNN (máximo 4 dígitos por número, máximo 2 puntos)"
    )
    .refine((codigo) => {
      const partes = codigo.split(".");
      return partes.length <= 3;
    }, "El código no puede tener más de 3 niveles"),
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
