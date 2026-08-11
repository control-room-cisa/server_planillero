import { z } from "zod";

export const createVehiculoSchema = z.object({
  body: z.object({
    class: z
      .number({ required_error: "El class es obligatorio" })
      .int("El class debe ser un entero")
      .positive("El class debe ser un número positivo"),
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(255, "El nombre no puede exceder 255 caracteres"),
    tipo: z
      .string()
      .max(20, "El tipo no puede exceder 20 caracteres")
      .optional()
      .nullable(),
  }),
});

export const updateVehiculoSchema = z.object({
  body: z.object({
    class: z
      .number()
      .int("El class debe ser un entero")
      .positive("El class debe ser un número positivo")
      .optional(),
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(255, "El nombre no puede exceder 255 caracteres")
      .optional(),
    tipo: z
      .string()
      .max(20, "El tipo no puede exceder 20 caracteres")
      .optional()
      .nullable(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
});

export type CreateVehiculoRequest = z.infer<typeof createVehiculoSchema>;
export type UpdateVehiculoRequest = z.infer<typeof updateVehiculoSchema>;
