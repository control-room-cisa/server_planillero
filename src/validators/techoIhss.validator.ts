import { z } from "zod";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

const montoSchema = z
  .number({ invalid_type_error: "Monto inválido" })
  .finite("Monto inválido")
  .positive("El monto debe ser mayor a 0");

export const techoIhssCreateSchema = z
  .object({
    fechaInicio: ymd,
    fechaFin: ymd,
    monto: montoSchema,
  })
  .refine((d) => d.fechaInicio <= d.fechaFin, {
    message: "La fecha de inicio no puede ser mayor que la fecha de fin",
    path: ["fechaFin"],
  });

export const techoIhssUpdateSchema = techoIhssCreateSchema;

export const TECHO_IHSS_PAGE_SIZE = 20;

export type TechoIhssCreateDto = z.infer<typeof techoIhssCreateSchema>;
export type TechoIhssUpdateDto = z.infer<typeof techoIhssUpdateSchema>;
