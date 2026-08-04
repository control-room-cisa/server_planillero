// src/validators/prorrateo.validator.ts
import { z } from "zod";

export const asignacionCompensatoriaTomadaSchema = z.object({
  jobId: z
    .number({
      invalid_type_error: "jobId debe ser un número",
    })
    .int()
    .positive("jobId debe ser un identificador válido")
    .nullable(),
  horas: z
    .number({
      required_error: "horas es requerido",
      invalid_type_error: "horas debe ser un número",
    })
    .positive("horas debe ser mayor a 0"),
});

export const guardarProrrateoSchema = z.object({
  nominaId: z
    .number({
      required_error: "nominaId es requerido",
      invalid_type_error: "nominaId debe ser un número",
    })
    .int()
    .positive("nominaId debe ser un identificador válido"),
  asignacionesCompensatoriasTomadas: z
    .array(asignacionCompensatoriaTomadaSchema)
    .optional()
    .default([]),
});

export type GuardarProrrateoDto = z.infer<typeof guardarProrrateoSchema>;
export type AsignacionCompensatoriaTomadaDto = z.infer<
  typeof asignacionCompensatoriaTomadaSchema
>;
