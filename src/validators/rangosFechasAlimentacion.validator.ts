import { z } from "zod";

/** Código nómina: YYYY (4) + MM (2) + A|B (primera o segunda quincena). */
const codigoNominaSchema = z
  .string()
  .regex(
    /^\d{4}(0[1-9]|1[0-2])(A|B)$/,
    "Código de nómina inválido (esperado YYYYMMA o YYYYMMB)",
  );

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const rangoFechasAlimentacionCreateSchema = z
  .object({
    codigoNomina: codigoNominaSchema,
    fechaInicio: ymd,
    fechaFin: ymd,
  })
  .refine((d) => d.fechaInicio <= d.fechaFin, {
    message: "La fecha de inicio no puede ser mayor que la fecha de fin",
    path: ["fechaFin"],
  });

export const rangoFechasAlimentacionUpdateSchema = z
  .object({
    fechaInicio: ymd,
    fechaFin: ymd,
  })
  .refine((d) => d.fechaInicio <= d.fechaFin, {
    message: "La fecha de inicio no puede ser mayor que la fecha de fin",
    path: ["fechaFin"],
  });

export type RangoFechasAlimentacionCreateDto = z.infer<
  typeof rangoFechasAlimentacionCreateSchema
>;
export type RangoFechasAlimentacionUpdateDto = z.infer<
  typeof rangoFechasAlimentacionUpdateSchema
>;
