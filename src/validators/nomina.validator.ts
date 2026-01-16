// src/validators/nomina.validator.ts
import { z } from "zod";

export const crearNominaSchema = z.object({
  empleadoId: z
    .number({ required_error: "El colaborador es requerido", invalid_type_error: "El colaborador debe ser un número válido" })
    .int("El ID del colaborador debe ser un número entero")
    .positive("El ID del colaborador debe ser un número positivo"),
  // empresaId se resolverá en backend a partir del empleado
  nombrePeriodoNomina: z
    .string({
      required_error: "El nombre del período es requerido",
      invalid_type_error: "El nombre del período debe ser un texto válido",
    })
    .min(1, "El nombre del período es requerido")
    .max(100, "El nombre del período no puede exceder 100 caracteres"),
  fechaInicio: z.coerce.date({
    required_error: "La fecha de inicio es requerida",
    invalid_type_error: "La fecha de inicio debe ser una fecha válida",
  }),
  fechaFin: z.coerce.date({
    required_error: "La fecha de fin es requerida",
    invalid_type_error: "La fecha de fin debe ser una fecha válida",
  }),
  sueldoMensual: z
    .number({
      required_error: "El sueldo mensual es requerido",
      invalid_type_error: "El sueldo mensual debe ser un número válido",
    })
    .nonnegative("El sueldo mensual no puede ser negativo"),

  diasLaborados: z
    .number({ invalid_type_error: "Los días laborados deben ser un número válido" })
    .nonnegative("Los días laborados no pueden ser negativos")
    .default(0),
  diasVacaciones: z
    .number({ invalid_type_error: "Los días de vacaciones deben ser un número válido" })
    .nonnegative("Los días de vacaciones no pueden ser negativos")
    .default(0),
  diasIncapacidad: z
    .number({ invalid_type_error: "Los días de incapacidad deben ser un número válido" })
    .nonnegative("Los días de incapacidad no pueden ser negativos")
    .default(0),

  subtotalQuincena: z
    .number({ invalid_type_error: "El subtotal de quincena debe ser un número válido" })
    .default(0),
  montoVacaciones: z
    .number({ invalid_type_error: "El monto de vacaciones debe ser un número válido" })
    .default(0),
  montoDiasLaborados: z
    .number({ invalid_type_error: "El monto de días laborados debe ser un número válido" })
    .default(0),
  montoExcedenteIHSS: z
    .number({ invalid_type_error: "El monto excedente de IHSS debe ser un número válido" })
    .default(0),
  montoIncapacidadCubreEmpresa: z
    .number({ invalid_type_error: "El monto de incapacidad que cubre la empresa debe ser un número válido" })
    .default(0),
  montoPermisosJustificados: z
    .number({ invalid_type_error: "El monto de permisos justificados debe ser un número válido" })
    .default(0),

  montoHoras25: z
    .number({ invalid_type_error: "El monto de horas al 25% debe ser un número válido" })
    .default(0),
  montoHoras50: z
    .number({ invalid_type_error: "El monto de horas al 50% debe ser un número válido" })
    .default(0),
  montoHoras75: z
    .number({ invalid_type_error: "El monto de horas al 75% debe ser un número válido" })
    .default(0),
  montoHoras100: z
    .number({ invalid_type_error: "El monto de horas al 100% debe ser un número válido" })
    .default(0),

  ajuste: z
    .number({ invalid_type_error: "El ajuste debe ser un número válido" })
    .default(0),
  totalPercepciones: z
    .number({ invalid_type_error: "El total de percepciones debe ser un número válido" })
    .default(0),
  deduccionIHSS: z
    .number({ invalid_type_error: "La deducción de IHSS debe ser un número válido" })
    .default(0),
  deduccionISR: z
    .number({ invalid_type_error: "La deducción de ISR debe ser un número válido" })
    .default(0),
  deduccionRAP: z
    .number({ invalid_type_error: "La deducción de RAP debe ser un número válido" })
    .default(0),
  deduccionAlimentacion: z
    .number({ invalid_type_error: "La deducción de alimentación debe ser un número válido" })
    .default(0),
  cobroPrestamo: z
    .number({ invalid_type_error: "El cobro de préstamo debe ser un número válido" })
    .default(0),
  impuestoVecinal: z
    .number({ invalid_type_error: "El impuesto vecinal debe ser un número válido" })
    .default(0),
  otros: z
    .number({ invalid_type_error: "El campo otros debe ser un número válido" })
    .default(0),
  totalDeducciones: z
    .number({ invalid_type_error: "El total de deducciones debe ser un número válido" })
    .default(0),
  totalNetoPagar: z
    .number({ invalid_type_error: "El total neto a pagar debe ser un número válido" })
    .default(0),

  comentario: z
    .string()
    .max(200, "El comentario no puede exceder 200 caracteres")
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : val)),
  pagado: z.boolean().optional(),
});

export type CrearNominaDto = z.infer<typeof crearNominaSchema>;

export const actualizarNominaSchema = crearNominaSchema.partial();
export type ActualizarNominaDto = z.infer<typeof actualizarNominaSchema>;
