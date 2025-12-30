import { z } from "zod";

export const createDepartamentoSchema = z.object({
  body: z.object({
    empresaId: z.number().int().positive("El ID de empresa es obligatorio"),
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(100, "El nombre no puede exceder 100 caracteres"),
    codigo: z
      .string()
      .max(45, "El código no puede exceder 45 caracteres")
      .optional()
      .nullable(),
  }),
});

export const updateDepartamentoSchema = z.object({
  body: z.object({
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(100, "El nombre no puede exceder 100 caracteres")
      .optional(),
    codigo: z
      .string()
      .max(45, "El código no puede exceder 45 caracteres")
      .optional()
      .nullable(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
});

export type CreateDepartamentoRequest = z.infer<
  typeof createDepartamentoSchema
>;
export type UpdateDepartamentoRequest = z.infer<
  typeof updateDepartamentoSchema
>;
