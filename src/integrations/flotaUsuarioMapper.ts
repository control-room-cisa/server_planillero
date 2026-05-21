import type { Empleado, Departamento, Empresa } from "@prisma/client";

export interface FlotaUsuarioPayload {
  codigo_empleado: string;
  nombre: string;
  apellido: string;
  contrasena: string;
  codigo_empresa: string | null;
  correo_electronico: string | null;
  nombre_usuario: string | null;
}

export type EmpleadoConEmpresa = Empleado & {
  departamento: Departamento & {
    empresa: Pick<Empresa, "codigo"> | null;
  };
};

const MAX_CODIGO = 10;
const MAX_NOMBRE = 25;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Mapea un empleado de Planillero al contrato del webhook de Flota.
 * Retorna null si faltan campos obligatorios para el API.
 */
export function mapEmpleadoToFlotaUsuario(
  empleado: EmpleadoConEmpresa
): FlotaUsuarioPayload | null {
  const codigo = empleado.codigo?.trim();
  if (!codigo) {
    return null;
  }

  const contrasena = empleado.contrasena?.trim();
  if (!contrasena) {
    return null;
  }

  const nombre = truncate(empleado.nombre.trim(), MAX_NOMBRE);
  const apellido = truncate((empleado.apellido ?? "").trim(), MAX_NOMBRE);
  const codigoEmpleado = truncate(codigo, MAX_CODIGO);

  const correo = empleado.correoElectronico?.trim();
  const login = empleado.nombreUsuario?.trim();

  return {
    codigo_empleado: codigoEmpleado,
    nombre,
    apellido,
    contrasena,
    codigo_empresa: empleado.departamento.empresa?.codigo?.trim() ?? null,
    correo_electronico: correo ? correo.toLowerCase() : null,
    nombre_usuario: login || null,
  };
}
