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

export const resumirComentariosProrrateoSchema = z.object({
  // jobId puede ser 0 en jobs especiales/feriados del cálculo en vivo
  jobId: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z
      .number({ invalid_type_error: "jobId debe ser un número" })
      .int()
      .nullable()
      .optional()
  ),
  codigoJob: z.preprocess(
    (v) => (v == null || v === "" ? null : String(v)),
    z.string().max(40).nullable().optional()
  ),
  nombreJob: z.preprocess(
    (v) => (v == null || v === "" ? null : String(v)),
    z.string().max(200).nullable().optional()
  ),
  comentarios: z
    .array(
      z.preprocess(
        (v) => (v == null ? "" : String(v)),
        z
          .string()
          .max(4000, "cada comentario no puede superar 4000 caracteres")
      )
    )
    .min(1, "comentarios debe tener al menos un elemento")
    .max(200, "máximo 200 comentarios por solicitud"),
});

export type ResumirComentariosProrrateoDto = z.infer<
  typeof resumirComentariosProrrateoSchema
>;
