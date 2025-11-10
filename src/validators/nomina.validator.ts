// src/validators/nomina.validator.ts
import { z } from "zod";

export const crearNominaSchema = z.object({
  empleadoId: z.number().int().positive("empleadoId es requerido"),
  // empresaId se resolverá en backend a partir del empleado
  nombrePeriodoNomina: z.string().max(100).optional(),
  fechaInicio: z.coerce.date({ required_error: "fechaInicio es requerida" }),
  fechaFin: z.coerce.date({ required_error: "fechaFin es requerida" }),
  sueldoMensual: z.number().nonnegative("sueldoMensual inválido"),

  diasLaborados: z.number().nonnegative().optional(),
  diasVacaciones: z.number().nonnegative().optional(),
  diasIncapacidad: z.number().nonnegative().optional(),

  subtotalQuincena: z.number().optional(),
  montoVacaciones: z.number().optional(),
  montoDiasLaborados: z.number().optional(),
  montoExcedenteIHSS: z.number().optional(),
  montoIncapacidadCubreEmpresa: z.number().optional(),
  montoPermisosJustificados: z.number().optional(),

  montoHoras25: z.number().optional(),
  montoHoras50: z.number().optional(),
  montoHoras75: z.number().optional(),
  montoHoras100: z.number().optional(),

  ajuste: z.number().optional(),
  totalPercepciones: z.number().optional(),
  deduccionIHSS: z.number().optional(),
  deduccionISR: z.number().optional(),
  deduccionRAP: z.number().optional(),
  deduccionAlimentacion: z.number().optional(),
  cobroPrestamo: z.number().optional(),
  impuestoVecinal: z.number().optional(),
  otros: z.number().optional(),
  totalDeducciones: z.number().optional(),
  totalNetoPagar: z.number().optional(),

  comentario: z
    .string()
    .max(200, "El comentario no debe exceder 200 caracteres")
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : val)),
});

export type CrearNominaDto = z.infer<typeof crearNominaSchema>;

export const actualizarNominaSchema = crearNominaSchema.partial();
export type ActualizarNominaDto = z.infer<typeof actualizarNominaSchema>;
