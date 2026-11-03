export type NotificacionEmpleadoDto = {
  id: number;
  codigo: string | null;
  nombre: string;
  apellido: string | null;
};

export type NotificacionLogDto = {
  id: number;
  categoria: string;
  descripcion: string;
  leida: boolean;
  leidaAt: Date | null;
  metadata: unknown;
  createdAt: Date | null;
  destinatario: NotificacionEmpleadoDto;
  actor: NotificacionEmpleadoDto | null;
};

export type CreateNotificacionLogInput = {
  destinatarioId: number;
  actorId?: number | null;
  categoria: string;
  descripcion: string;
  metadata?: unknown;
};

export type PaginatedDto<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
