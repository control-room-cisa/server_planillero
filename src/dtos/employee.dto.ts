import {
  TipoHorario,
  EstadoCivil,
  TipoContrato,
  TipoCuenta,
} from "@prisma/client";

/** Lo que devuelve el controlador al cliente (versión básica para listas) */
export interface EmployeeDto {
  id: number;
  nombre: string;
  apellido?: string;
  codigo?: string;
  departamento?: string;
  empresaId?: number;
  empresa?: { nombre: string };
  activo?: boolean;
  cargo?: string;
  rolId?: number;
  urlFotoPerfil?: string;
  urlCv?: string;
  /**
   * Resumen de registros diarios de los últimos 20 días para validaciones rápidas en frontend
   */
  registrosUltimos20Dias?: Array<{
    fecha: string; // YYYY-MM-DD
    aprobacionSupervisor?: boolean | null;
    aprobacionRrhh?: boolean | null;
  }>;
}

/** Lo que devuelve el controlador al cliente (versión completa para detalles) */
export interface EmployeeDetailDto {
  id: number;
  nombre: string;
  apellido?: string;
  codigo?: string;
  departamento?: string;
  empresaId?: number;
  urlFotoPerfil?: string;
  urlCv?: string;
  // Campos adicionales para vista completa
  nombreUsuario?: string;
  correoElectronico?: string;
  dni?: string;
  profesion?: string;
  tipoHorario?: string; // Valor mapeado del enum (ej: "Normal - Lunes a Viernes (H1.1)")
  estadoCivil?: EstadoCivil;
  nombreConyugue?: string;
  cargo?: string;
  sueldoMensual?: number;
  tipoContrato?: string; // Valor mapeado del enum (ej: "7x7", "Indefinido Normal")
  condicionSalud?: string;
  nombreContactoEmergencia?: string;
  numeroContactoEmergencia?: string;
  banco?: string;
  tipoCuenta?: string; // Valor mapeado del enum (ej: "Ahorros moneda nacional")
  numeroCuenta?: string;
  muerteBeneficiario?: string;
  nombreMadre?: string;
  nombrePadre?: string;
  activo?: boolean;
  telefono?: string;
  direccion?: string;
  fechaInicioIngreso?: Date;
  rolId?: number;
  departamentoId?: number;
  tiempoCompensatorioHoras?: number;
  tiempoVacacionesHoras?: number;
}

/** Payload para crear un empleado */
export interface CreateEmpleadoDto {
  codigo?: string;
  nombre: string;
  apellido?: string;
  nombreUsuario?: string;
  correoElectronico?: string;
  dni?: string;
  profesion?: string;
  tipoHorario?: TipoHorario;
  estadoCivil?: EstadoCivil;
  nombreConyugue?: string;
  cargo?: string;
  sueldoMensual?: number;
  tipoContrato?: TipoContrato;
  condicionSalud?: string;
  nombreContactoEmergencia?: string;
  numeroContactoEmergencia?: string;
  banco?: string;
  tipoCuenta?: TipoCuenta;
  numeroCuenta?: string;
  muerteBeneficiario?: string;
  nombreMadre?: string;
  nombrePadre?: string;
  activo: boolean;
  telefono?: string;
  direccion?: string;
  fechaInicioIngreso?: Date;
  contrasena?: string;
  urlFotoPerfil?: string | null;
  urlCv?: string | null;
  rolId: number;
  departamentoId: number;
}

/** Payload para actualizar un empleado: todos opcionales menos `id`, sin contraseña */
export interface UpdateEmpleadoDto {
  id: number;
  codigo?: string;
  nombre?: string;
  apellido?: string;
  nombreUsuario?: string;
  correoElectronico?: string;
  dni?: string;
  profesion?: string;
  tipoHorario?: TipoHorario;
  estadoCivil?: EstadoCivil;
  nombreConyugue?: string;
  cargo?: string;
  sueldoMensual?: number;
  tipoContrato?: TipoContrato;
  condicionSalud?: string;
  nombreContactoEmergencia?: string;
  numeroContactoEmergencia?: string;
  banco?: string;
  tipoCuenta?: TipoCuenta;
  numeroCuenta?: string;
  muerteBeneficiario?: string;
  nombreMadre?: string;
  nombrePadre?: string;
  activo?: boolean;
  telefono?: string;
  direccion?: string;
  fechaInicioIngreso?: Date;
  contrasena?: string;
  urlFotoPerfil?: string | null;
  urlCv?: string | null;
  rolId?: number;
  departamentoId?: number;
}
