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
  codigo: z.string().max(20).optional(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().max(100).optional(),
  nombreUsuario: z.string().max(15).optional(),
  correoElectronico: z.string().email(),
  dni: z.string().max(45).optional(),
  profesion: z.string().max(30).optional(),
  tipoHorario: z.nativeEnum(TipoHorario).optional(),
  estadoCivil: z.nativeEnum(EstadoCivil).optional(),
  nombreConyugue: z.string().max(40).optional(),
  cargo: z.string().max(30).optional(),
  sueldoMensual: z.number().optional(),
  tipoContrato: z.nativeEnum(TipoContrato).optional(),
  condicionSalud: z.string().max(50).optional(),
  nombreContactoEmergencia: z.string().max(40).optional(),
  numeroContactoEmergencia: z.string().max(20).optional(),
  banco: z.string().max(25).optional(),
  tipoCuenta: z.nativeEnum(TipoCuenta).optional(),
  numeroCuenta: z.string().max(20).optional(),
  muerteBeneficiario: z.string().max(40).optional(),
  nombreMadre: z.string().max(40).optional(),
  nombrePadre: z.string().max(40).optional(),
  activo: z.boolean(),
  telefono: z.string().max(45).optional(),
  direccion: z.string().max(250).optional(),
  fechaInicioIngreso: z.preprocess(
    (val) => (val ? new Date(val as string) : undefined),
    z.date().optional()
  ),
  contrasena: z.string().min(6).optional(),
  urlFotoPerfil: z
    .union([z.string().url(), z.string().length(0), z.null(), z.undefined()])
    .optional(),
  urlCv: z
    .union([z.string().url(), z.string().length(0), z.null(), z.undefined()])
    .optional(),
  rolId: z.number().int().positive(),
  departamentoId: z.number().int().positive(),
};

// Esquema para creación
export const createEmpleadoSchema = z.object(empleadoFields);

// Esquema para actualización: todos opcionales + id obligatorio, pero sin contraseña
export const updateEmpleadoSchema = z.object({
  id: z.number().int().positive(),
  codigo: z.string().max(20).optional(),
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().max(100).optional(),
  nombreUsuario: z.string().max(15).optional(),
  correoElectronico: z.string().email().optional(),
  dni: z.string().max(45).optional(),
  profesion: z.string().max(30).optional(),
  tipoHorario: z.nativeEnum(TipoHorario).optional(),
  estadoCivil: z.nativeEnum(EstadoCivil).optional(),
  nombreConyugue: z.string().max(40).optional(),
  cargo: z.string().max(30).optional(),
  sueldoMensual: z.number().optional(),
  tipoContrato: z.nativeEnum(TipoContrato).optional(),
  condicionSalud: z.string().max(50).optional(),
  nombreContactoEmergencia: z.string().max(40).optional(),
  numeroContactoEmergencia: z.string().max(20).optional(),
  banco: z.string().max(25).optional(),
  tipoCuenta: z.nativeEnum(TipoCuenta).optional(),
  numeroCuenta: z.string().max(20).optional(),
  muerteBeneficiario: z.string().max(40).optional(),
  nombreMadre: z.string().max(40).optional(),
  nombrePadre: z.string().max(40).optional(),
  activo: z.boolean().optional(),
  telefono: z.string().max(45).optional(),
  direccion: z.string().max(250).optional(),
  fechaInicioIngreso: z
    .preprocess(
      (val) => (val ? new Date(val as string) : undefined),
      z.date().optional()
    )
    .optional(),
  contrasena: z.string().min(6).optional(),
  urlFotoPerfil: z
    .union([z.string().url(), z.string().length(0), z.null(), z.undefined()])
    .optional(),
  urlCv: z
    .union([z.string().url(), z.string().length(0), z.null(), z.undefined()])
    .optional(),
  rolId: z.number().int().positive().optional(),
  departamentoId: z.number().int().positive().optional(),
});
