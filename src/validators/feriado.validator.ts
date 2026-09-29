// src/validators/feriado.validator.ts
import { z } from "zod";

/** Acepta HH:mm o HH:mm:ss y normaliza a HH:mm */
const horaHHmmSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "El formato de hora debe ser HH:mm")
  .transform((value) => value.slice(0, 5));

const optionalHoraSchema = z
  .union([horaHHmmSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const createFeriadoSchema = z
  .object({
    nombre: z
      .string()
      .min(1, "El nombre es requerido")
      .max(45, "El nombre no puede tener más de 45 caracteres"),
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de fecha debe ser YYYY-MM-DD"),
    descripcion: z
      .string()
      .max(255, "La descripción no puede tener más de 255 caracteres")
      .optional()
      .nullable(),
    tipo: z.enum(["TODO_EL_DIA", "DESDE", "HASTA"]).default("TODO_EL_DIA"),
    horaDesde: optionalHoraSchema,
    horaHasta: optionalHoraSchema,
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "DESDE" && !data.horaDesde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La hora desde es requerida para feriados parciales desde",
        path: ["horaDesde"],
      });
    }

    if (data.tipo === "HASTA" && !data.horaHasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La hora hasta es requerida para feriados parciales hasta",
        path: ["horaHasta"],
      });
    }
  })
  .transform((data) => {
    if (data.tipo === "TODO_EL_DIA") {
      return { ...data, horaDesde: null, horaHasta: null };
    }
    if (data.tipo === "DESDE") {
      return { ...data, horaHasta: null };
    }
    return { ...data, horaDesde: null };
  });

export type CreateFeriadoDto = z.infer<typeof createFeriadoSchema>;
