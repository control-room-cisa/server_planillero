import { TipoHorario, EstadoCivil, TipoContrato } from "@prisma/client";

/** Lo que devuelve el controlador al cliente */
export interface EmployeeDto {
  id: number;
  nombre: string;
  apellido?: string;
  codigo?: string;
  departamento?: string;
  empresaId?: number;
  urlFotoPerfil?: string;
  urlCv?: string;
}

/** Payload para crear un empleado */
export interface CreateEmpleadoDto {
  codigo?: string;
  nombre: string;
  apellido?: string;
  nombreUsuario?: string;
  correoElectronico: string;
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
  tipoCuenta?: string;
  numeroCuenta?: string;
  muerteBeneficiario?: string;
  nombreMadre?: string;
  nombrePadre?: string;
  activo: boolean;
  telefono?: string;
  direccion?: string;
  fechaInicioIngreso?: Date;
  contrasena: string;
  urlFotoPerfil?: string;
  urlCv?: string;
  rolId: number;
  departamentoId: number;
}

/** Payload para actualizar un empleado: todos opcionales menos `id` */
export interface UpdateEmpleadoDto extends Partial<CreateEmpleadoDto> {
  id: number;
}
