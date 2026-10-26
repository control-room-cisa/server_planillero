export type TipoSolicitudPermisoDto = "VACACIONES" | "PERMISO";

export type PaginationDto = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedDto<T> = {
  items: T[];
  pagination: PaginationDto;
};

export type SolicitudPermisoEmpleadoDto = {
  id: number;
  codigo: string | null;
  nombre: string;
  apellido: string | null;
  departamento: string | null;
  empresaId: number | null;
  empresa: string | null;
};

export type SolicitudPermisoDiaDto = {
  id: number;
  fecha: string;
  comentarioHorario: string | null;
};

export type SolicitudPermisoDto = {
  id: number;
  tipo: TipoSolicitudPermisoDto;
  comentario: string | null;
  aprobacionSupervisor: boolean | null;
  aprobacionRrhh: boolean | null;
  comentarioSupervisor: string | null;
  comentarioRrhh: string | null;
  fechaAprobacionSupervisor: Date | null;
  fechaAprobacionRrhh: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  empleado: SolicitudPermisoEmpleadoDto;
  totalDias: number;
  primeraFecha: string | null;
  ultimaFecha: string | null;
  editable: boolean;
};

export type CalendarioDiaDto = {
  fecha: string;
  solicitados: number;
  aprobados: number;
};

export type CalendarioOcupacionDto = {
  persona: SolicitudPermisoEmpleadoDto;
  solicitudId: number;
  tipo: TipoSolicitudPermisoDto;
  estado: "SOLICITADO" | "APROBADO";
  comentarioHorario: string | null;
};

export type DiaSolicitudInput = {
  fecha: string;
  comentarioHorario?: string | null;
};
