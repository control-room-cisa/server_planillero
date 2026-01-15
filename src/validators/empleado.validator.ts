// src/validators/empleado.validator.ts
import { z } from "zod";
import {
  TipoHorario,
  EstadoCivil,
  TipoContrato,
  TipoCuenta,
} from "@prisma/client";

// Campos base sacados de CreateEmpleadoDto
const empleadoFields = {
  codigo: z
    .string({ required_error: "El código es requerido" })
    .max(20, "El código no puede tener más de 20 caracteres")
    .optional(),
  nombre: z
    .string({ required_error: "El nombre es requerido" })
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  apellido: z
    .string()
    .max(100, "El apellido no puede tener más de 100 caracteres")
    .optional(),
  nombreUsuario: z
    .string({ required_error: "El nombre de usuario es requerido" })
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(15, "El nombre de usuario no puede tener más de 15 caracteres"),
  correoElectronico: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val || val.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "Formato de correo electrónico inválido" }
    ),
  dni: z
    .string()
    .max(45, "El DNI no puede tener más de 45 caracteres")
    .optional(),
  profesion: z
    .string()
    .max(30, "La profesión no puede tener más de 30 caracteres")
    .optional(),
  tipoHorario: z
    .nativeEnum(TipoHorario, {
      errorMap: () => ({ message: "Tipo de horario inválido" }),
    })
    .optional(),
  estadoCivil: z
    .nativeEnum(EstadoCivil, {
      errorMap: () => ({ message: "Estado civil inválido" }),
    })
    .optional(),
  nombreConyugue: z
    .string()
    .max(40, "El nombre del cónyuge no puede tener más de 40 caracteres")
    .optional(),
  cargo: z
    .string()
    .max(30, "El cargo no puede tener más de 30 caracteres")
    .optional(),
  sueldoMensual: z
    .number({ invalid_type_error: "El sueldo mensual debe ser un número" })
    .optional(),
  tipoContrato: z
    .nativeEnum(TipoContrato, {
      errorMap: () => ({ message: "Tipo de contrato inválido" }),
    })
    .optional(),
  condicionSalud: z
    .string()
    .max(50, "La condición de salud no puede tener más de 50 caracteres")
    .optional(),
  nombreContactoEmergencia: z
    .string()
    .max(
      40,
      "El nombre del contacto de emergencia no puede tener más de 40 caracteres"
    )
    .optional(),
  numeroContactoEmergencia: z
    .string()
    .max(
      20,
      "El número del contacto de emergencia no puede tener más de 20 caracteres"
    )
    .optional(),
  banco: z
    .string()
    .max(25, "El nombre del banco no puede tener más de 25 caracteres")
    .optional(),
  tipoCuenta: z
    .nativeEnum(TipoCuenta, {
      errorMap: () => ({ message: "Tipo de cuenta inválido" }),
    })
    .optional(),
  numeroCuenta: z
    .string()
    .max(20, "El número de cuenta no puede tener más de 20 caracteres")
    .optional(),
  muerteBeneficiario: z
    .string()
    .max(40, "El beneficiario no puede tener más de 40 caracteres")
    .optional(),
  nombreMadre: z
    .string()
    .max(40, "El nombre de la madre no puede tener más de 40 caracteres")
    .optional(),
  nombrePadre: z
    .string()
    .max(40, "El nombre del padre no puede tener más de 40 caracteres")
    .optional(),
  activo: z.boolean({
    required_error: "El estado activo es requerido",
    invalid_type_error: "El estado activo debe ser verdadero o falso",
  }),
  telefono: z
    .string()
    .max(45, "El teléfono no puede tener más de 45 caracteres")
    .optional(),
  direccion: z
    .string()
    .max(250, "La dirección no puede tener más de 250 caracteres")
    .optional(),
  fechaInicioIngreso: z.preprocess(
    (val) => (val ? new Date(val as string) : undefined),
    z
      .date({
        invalid_type_error: "La fecha de ingreso debe ser una fecha válida",
      })
      .optional()
  ),
  editTime: z.preprocess(
    (val) => (val ? new Date(val as string) : undefined),
    z
      .date({
        invalid_type_error: "La fecha/hora límite de edición debe ser una fecha válida",
      })
      .nullable()
      .optional()
  ),
  contrasena: z
    .string({ required_error: "La contraseña es requerida" })
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .optional(),
  urlFotoPerfil: z
    .union([
      z.string().url("La URL de la foto de perfil debe ser válida"),
      z.string().length(0),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  urlCv: z
    .union([
      z.string().url("La URL del CV debe ser válida"),
      z.string().length(0),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  rolId: z
    .number({
      required_error: "El rol es requerido",
      invalid_type_error: "El rol debe ser un número",
    })
    .int("El rol debe ser un número entero")
    .positive("El rol debe ser positivo"),
  departamentoId: z
    .number({
      required_error: "El departamento es requerido",
      invalid_type_error: "El departamento debe ser un número",
    })
    .int("El departamento debe ser un número entero")
    .positive("El departamento debe ser positivo"),
};

// Esquema para creación
export const createEmpleadoSchema = z.object(empleadoFields);

// Esquema para actualización: todos opcionales + id obligatorio, pero sin contraseña
export const updateEmpleadoSchema = z.object({
  id: z
    .number({
      required_error: "El ID es requerido",
      invalid_type_error: "El ID debe ser un número",
    })
    .int("El ID debe ser un número entero")
    .positive("El ID debe ser positivo"),
  codigo: z
    .string()
    .max(20, "El código no puede tener más de 20 caracteres")
    .optional(),
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .optional(),
  apellido: z
    .string()
    .max(100, "El apellido no puede tener más de 100 caracteres")
    .optional(),
  nombreUsuario: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(15, "El nombre de usuario no puede tener más de 15 caracteres")
    .optional(),
  correoElectronico: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val || val.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "Formato de correo electrónico inválido" }
    ),
  dni: z
    .string()
    .max(45, "El DNI no puede tener más de 45 caracteres")
    .optional(),
  profesion: z
    .string()
    .max(30, "La profesión no puede tener más de 30 caracteres")
    .optional(),
  tipoHorario: z
    .nativeEnum(TipoHorario, {
      errorMap: () => ({ message: "Tipo de horario inválido" }),
    })
    .optional(),
  estadoCivil: z
    .nativeEnum(EstadoCivil, {
      errorMap: () => ({ message: "Estado civil inválido" }),
    })
    .optional(),
  nombreConyugue: z
    .string()
    .max(40, "El nombre del cónyuge no puede tener más de 40 caracteres")
    .optional(),
  cargo: z
    .string()
    .max(30, "El cargo no puede tener más de 30 caracteres")
    .optional(),
  sueldoMensual: z
    .number({ invalid_type_error: "El sueldo mensual debe ser un número" })
    .optional(),
  tipoContrato: z
    .nativeEnum(TipoContrato, {
      errorMap: () => ({ message: "Tipo de contrato inválido" }),
    })
    .optional(),
  condicionSalud: z
    .string()
    .max(50, "La condición de salud no puede tener más de 50 caracteres")
    .optional(),
  nombreContactoEmergencia: z
    .string()
    .max(
      40,
      "El nombre del contacto de emergencia no puede tener más de 40 caracteres"
    )
    .optional(),
  numeroContactoEmergencia: z
    .string()
    .max(
      20,
      "El número del contacto de emergencia no puede tener más de 20 caracteres"
    )
    .optional(),
  banco: z
    .string()
    .max(25, "El nombre del banco no puede tener más de 25 caracteres")
    .optional(),
  tipoCuenta: z
    .nativeEnum(TipoCuenta, {
      errorMap: () => ({ message: "Tipo de cuenta inválido" }),
    })
    .optional(),
  numeroCuenta: z
    .string()
    .max(20, "El número de cuenta no puede tener más de 20 caracteres")
    .optional(),
  muerteBeneficiario: z
    .string()
    .max(40, "El beneficiario no puede tener más de 40 caracteres")
    .optional(),
  nombreMadre: z
    .string()
    .max(40, "El nombre de la madre no puede tener más de 40 caracteres")
    .optional(),
  nombrePadre: z
    .string()
    .max(40, "El nombre del padre no puede tener más de 40 caracteres")
    .optional(),
  activo: z
    .boolean({
      invalid_type_error: "El estado activo debe ser verdadero o falso",
    })
    .optional(),
  telefono: z
    .string()
    .max(45, "El teléfono no puede tener más de 45 caracteres")
    .optional(),
  direccion: z
    .string()
    .max(250, "La dirección no puede tener más de 250 caracteres")
    .optional(),
  fechaInicioIngreso: z
    .preprocess(
      (val) => (val ? new Date(val as string) : undefined),
      z
        .date({
          invalid_type_error: "La fecha de ingreso debe ser una fecha válida",
        })
        .optional()
    )
    .optional(),
  editTime: z
    .preprocess(
      (val) => (val ? new Date(val as string) : undefined),
      z
        .date({
          invalid_type_error: "La fecha/hora límite de edición debe ser una fecha válida",
        })
        .nullable()
        .optional()
    )
    .optional(),
  contrasena: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .optional(),
  urlFotoPerfil: z
    .union([
      z.string().url("La URL de la foto de perfil debe ser válida"),
      z.string().length(0),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  urlCv: z
    .union([
      z.string().url("La URL del CV debe ser válida"),
      z.string().length(0),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  rolId: z
    .number({ invalid_type_error: "El rol debe ser un número" })
    .int("El rol debe ser un número entero")
    .positive("El rol debe ser positivo")
    .optional(),
  departamentoId: z
    .number({ invalid_type_error: "El departamento debe ser un número" })
    .int("El departamento debe ser un número entero")
    .positive("El departamento debe ser positivo")
    .optional(),
});
