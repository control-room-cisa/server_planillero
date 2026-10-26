import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import type {
  CalendarioDiaDto,
  CalendarioOcupacionDto,
  PaginatedDto,
  SolicitudPermisoDiaDto,
  SolicitudPermisoDto,
  SolicitudPermisoEmpleadoDto,
} from "../dtos/solicitudPermiso.dto";
import type {
  CreateSolicitudPermisoBody,
  DecisionSolicitudBody,
  UpdateSolicitudPermisoBody,
} from "../validators/solicitudPermiso.validator";
import {
  SolicitudPermisoRepository,
  type SolicitudPermisoRow,
} from "../repositories/SolicitudPermisoRepository";

function pagination(
  page: number,
  limit: number,
  total: number
): PaginatedDto<never>["pagination"] {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function empleadoDto(
  empleado: SolicitudPermisoRow["empleadoSolicitante"]
): SolicitudPermisoEmpleadoDto {
  return {
    id: empleado.id,
    codigo: empleado.codigo,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    departamento: empleado.departamento?.nombre ?? null,
    empresaId: empleado.departamento?.empresaId ?? null,
    empresa: empleado.departamento?.empresa?.nombre ?? null,
  };
}

function isEditable(row: {
  aprobacionSupervisor: boolean | null;
  aprobacionRrhh: boolean | null;
}): boolean {
  return row.aprobacionSupervisor === null && row.aprobacionRrhh === null;
}

function mapSolicitud(
  row: SolicitudPermisoRow,
  resumen?: {
    _count: { _all: number };
    _min: { fecha: string | null };
    _max: { fecha: string | null };
  }
): SolicitudPermisoDto {
  return {
    id: row.id,
    tipo: row.tipo,
    comentario: row.comentario,
    aprobacionSupervisor: row.aprobacionSupervisor,
    aprobacionRrhh: row.aprobacionRrhh,
    comentarioSupervisor: row.comentarioSupervisor,
    comentarioRrhh: row.comentarioRrhh,
    fechaAprobacionSupervisor: row.fechaAprobacionSupervisor,
    fechaAprobacionRrhh: row.fechaAprobacionRrhh,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    empleado: empleadoDto(row.empleadoSolicitante),
    totalDias: resumen?._count._all ?? 0,
    primeraFecha: resumen?._min.fecha ?? null,
    ultimaFecha: resumen?._max.fecha ?? null,
    editable: isEditable(row),
  };
}

async function hydrate(
  rows: SolicitudPermisoRow[]
): Promise<SolicitudPermisoDto[]> {
  const resumen = await SolicitudPermisoRepository.resumenDias(
    rows.map((row) => row.id)
  );
  const byId = new Map(resumen.map((row) => [row.solicitudId, row]));
  return rows.map((row) => mapSolicitud(row, byId.get(row.id)));
}

async function orderedByIds(ids: number[]): Promise<SolicitudPermisoDto[]> {
  const rows = await SolicitudPermisoRepository.findByIds(ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((row): row is SolicitudPermisoRow => Boolean(row));
  return hydrate(ordered);
}

function assertFechasLibres(fechas: string[]) {
  if (fechas.length === 0) return;
  throw new AppError(
    `Estas fechas ya están en otra solicitud pendiente o aprobada: ${fechas.join(", ")}`,
    409
  );
}

export class SolicitudPermisoService {
  static async listPropias(
    empleadoId: number,
    page: number,
    limit: number
  ): Promise<PaginatedDto<SolicitudPermisoDto>> {
    const skip = (page - 1) * limit;
    const { total, ids } = await SolicitudPermisoRepository.listPropias(
      empleadoId,
      skip,
      limit
    );
    return {
      items: await orderedByIds(ids),
      pagination: pagination(page, limit, total),
    };
  }

  static async create(empleadoId: number, body: CreateSolicitudPermisoBody) {
    const row = await prisma.$transaction(async (tx) => {
      const ocupadas = await SolicitudPermisoRepository.fechasOcupadas(
        tx,
        empleadoId,
        body.dias.map((dia) => dia.fecha)
      );
      assertFechasLibres(ocupadas);
      return SolicitudPermisoRepository.create(
        tx,
        empleadoId,
        body.tipo,
        cleanText(body.comentario),
        body.dias
      );
    });
    const [dto] = await hydrate([row]);
    return dto;
  }

  static async update(
    empleadoId: number,
    solicitudId: number,
    body: UpdateSolicitudPermisoBody
  ) {
    const actual = await this.requireOwnedEditable(empleadoId, solicitudId);
    const row = await prisma.$transaction(async (tx) => {
      const ocupadas = await SolicitudPermisoRepository.fechasOcupadas(
        tx,
        empleadoId,
        body.dias.map((dia) => dia.fecha),
        actual.id
      );
      assertFechasLibres(ocupadas);
      return SolicitudPermisoRepository.replace(
        tx,
        actual.id,
        empleadoId,
        body.tipo,
        cleanText(body.comentario),
        body.dias
      );
    });
    const [dto] = await hydrate([row]);
    return dto;
  }

  static async remove(empleadoId: number, solicitudId: number) {
    const actual = await this.requireOwnedEditable(empleadoId, solicitudId);
    await SolicitudPermisoRepository.softDelete(actual.id, empleadoId);
  }

  static async getForEmpleado(empleadoId: number, solicitudId: number) {
    const row = await SolicitudPermisoRepository.findById(solicitudId);
    if (!row || row.empleadoSolicitanteId !== empleadoId) {
      throw new AppError("Solicitud no encontrada", 404);
    }
    const [dto] = await hydrate([row]);
    return dto;
  }

  static async listDias(
    viewer: { id: number; departamentoId: number; rol: "empleado" | "supervisor" | "rrhh" },
    solicitudId: number,
    page: number,
    limit: number
  ): Promise<PaginatedDto<SolicitudPermisoDiaDto>> {
    await this.requireVisible(viewer, solicitudId);
    const skip = (page - 1) * limit;
    const { total, items } = await SolicitudPermisoRepository.listDias(
      solicitudId,
      skip,
      limit
    );
    return {
      items,
      pagination: pagination(page, limit, total),
    };
  }

  static async listSupervision(
    supervisorId: number,
    departamentoId: number,
    page: number,
    limit: number
  ): Promise<PaginatedDto<SolicitudPermisoDto>> {
    const teamIds = await SolicitudPermisoRepository.teamEmpleadoIds(
      supervisorId,
      departamentoId
    );
    const where: Prisma.SolicitudPermisoWhereInput = {
      deletedAt: null,
      empleadoSolicitanteId: { in: teamIds },
    };
    const skip = (page - 1) * limit;
    const [total, ids] = await Promise.all([
      teamIds.length === 0
        ? Promise.resolve(0)
        : SolicitudPermisoRepository.count(where),
      SolicitudPermisoRepository.listSupervisionIds(teamIds, skip, limit),
    ]);
    return {
      items: await orderedByIds(ids),
      pagination: pagination(page, limit, total),
    };
  }

  static async pendientesSupervision(
    supervisorId: number,
    departamentoId: number
  ): Promise<number> {
    const teamIds = await SolicitudPermisoRepository.teamEmpleadoIds(
      supervisorId,
      departamentoId
    );
    const ids = teamIds.filter((id) => id !== supervisorId);
    if (ids.length === 0) return 0;
    return SolicitudPermisoRepository.count({
      deletedAt: null,
      aprobacionSupervisor: null,
      empleadoSolicitanteId: { in: ids },
    });
  }

  static async calendario(
    supervisorId: number,
    departamentoId: number,
    desde: string,
    hasta: string
  ): Promise<CalendarioDiaDto[]> {
    const teamIds = await SolicitudPermisoRepository.teamEmpleadoIds(
      supervisorId,
      departamentoId
    );
    const rows = await SolicitudPermisoRepository.marcasCalendario(
      teamIds,
      desde,
      hasta
    );
    const byFecha = new Map<string, CalendarioDiaDto>();
    for (const row of rows) {
      const current = byFecha.get(row.fecha) ?? {
        fecha: row.fecha,
        solicitados: 0,
        aprobados: 0,
      };
      if (row.solicitud.aprobacionSupervisor === true) current.aprobados += 1;
      else current.solicitados += 1;
      byFecha.set(row.fecha, current);
    }
    return [...byFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  static async ocupacionDia(
    supervisorId: number,
    departamentoId: number,
    fecha: string,
    page: number,
    limit: number
  ): Promise<PaginatedDto<CalendarioOcupacionDto>> {
    const teamIds = await SolicitudPermisoRepository.teamEmpleadoIds(
      supervisorId,
      departamentoId
    );
    const skip = (page - 1) * limit;
    const { total, items } = await SolicitudPermisoRepository.ocupacionDia(
      teamIds,
      fecha,
      skip,
      limit
    );
    return {
      items: items.map((item) => ({
        persona: empleadoDto(item.solicitud.empleadoSolicitante),
        solicitudId: item.solicitud.id,
        tipo: item.solicitud.tipo,
        estado:
          item.solicitud.aprobacionSupervisor === true
            ? "APROBADO"
            : "SOLICITADO",
        comentarioHorario: item.comentarioHorario,
      })),
      pagination: pagination(page, limit, total),
    };
  }

  static async getForSupervisor(
    supervisorId: number,
    departamentoId: number,
    solicitudId: number
  ) {
    const row = await this.requireInTeam(
      supervisorId,
      departamentoId,
      solicitudId
    );
    const [dto] = await hydrate([row]);
    return dto;
  }

  static async decidirSupervisor(
    supervisorId: number,
    departamentoId: number,
    solicitudId: number,
    body: DecisionSolicitudBody
  ) {
    const row = await this.requireInTeam(
      supervisorId,
      departamentoId,
      solicitudId
    );
    if (row.empleadoSolicitanteId === supervisorId) {
      throw new AppError("No puedes decidir tu propia solicitud", 403);
    }
    if (row.aprobacionSupervisor !== null) {
      throw new AppError("Esta solicitud ya fue decidida por supervisión", 409);
    }
    const updated = await SolicitudPermisoRepository.decidirSupervisor(
      row.id,
      supervisorId,
      body.aprobado,
      cleanText(body.comentario)
    );
    const [dto] = await hydrate([updated]);
    return dto;
  }

  static async listRrhh(
    empresaId: number,
    page: number,
    limit: number
  ): Promise<PaginatedDto<SolicitudPermisoDto>> {
    const where: Prisma.SolicitudPermisoWhereInput = {
      deletedAt: null,
      aprobacionSupervisor: true,
      empleadoSolicitante: { departamento: { empresaId } },
    };
    const skip = (page - 1) * limit;
    const [total, ids] = await Promise.all([
      SolicitudPermisoRepository.count(where),
      SolicitudPermisoRepository.listRrhhIds(empresaId, skip, limit),
    ]);
    return {
      items: await orderedByIds(ids),
      pagination: pagination(page, limit, total),
    };
  }

  static async pendientesRrhh(rrhhId: number): Promise<number> {
    return SolicitudPermisoRepository.count({
      deletedAt: null,
      aprobacionSupervisor: true,
      aprobacionRrhh: null,
      empleadoSolicitanteId: { not: rrhhId },
      empleadoSolicitante: {
        departamento: { empresa: { esConsorcio: true } },
      },
    });
  }

  static async getForRrhh(solicitudId: number) {
    const row = await SolicitudPermisoRepository.findById(solicitudId);
    if (!row || row.aprobacionSupervisor !== true) {
      throw new AppError("Solicitud no encontrada", 404);
    }
    const [dto] = await hydrate([row]);
    return dto;
  }

  static async decidirRrhh(
    rrhhId: number,
    solicitudId: number,
    body: DecisionSolicitudBody
  ) {
    const row = await SolicitudPermisoRepository.findById(solicitudId);
    if (!row || row.aprobacionSupervisor !== true) {
      throw new AppError("Solicitud no encontrada", 404);
    }
    if (row.empleadoSolicitanteId === rrhhId) {
      throw new AppError("No puedes decidir tu propia solicitud", 403);
    }
    if (row.aprobacionRrhh !== null) {
      throw new AppError("Esta solicitud ya fue decidida por RRHH", 409);
    }
    const updated = await SolicitudPermisoRepository.decidirRrhh(
      row.id,
      rrhhId,
      body.aprobado,
      cleanText(body.comentario)
    );
    const [dto] = await hydrate([updated]);
    return dto;
  }

  private static async requireOwnedEditable(
    empleadoId: number,
    solicitudId: number
  ) {
    const row = await SolicitudPermisoRepository.findById(solicitudId);
    if (!row || row.empleadoSolicitanteId !== empleadoId) {
      throw new AppError("Solicitud no encontrada", 404);
    }
    if (!isEditable(row)) {
      throw new AppError(
        "La solicitud ya tiene una decisión y no se puede modificar",
        409
      );
    }
    return row;
  }

  private static async requireInTeam(
    supervisorId: number,
    departamentoId: number,
    solicitudId: number
  ) {
    const row = await SolicitudPermisoRepository.findById(solicitudId);
    if (!row) throw new AppError("Solicitud no encontrada", 404);
    const teamIds = await SolicitudPermisoRepository.teamEmpleadoIds(
      supervisorId,
      departamentoId
    );
    if (!teamIds.includes(row.empleadoSolicitanteId)) {
      throw new AppError("No tienes permiso para ver esta solicitud", 403);
    }
    return row;
  }

  private static async requireVisible(
    viewer: {
      id: number;
      departamentoId: number;
      rol: "empleado" | "supervisor" | "rrhh";
    },
    solicitudId: number
  ) {
    if (viewer.rol === "empleado") {
      return this.getForEmpleado(viewer.id, solicitudId);
    }
    if (viewer.rol === "supervisor") {
      return this.getForSupervisor(
        viewer.id,
        viewer.departamentoId,
        solicitudId
      );
    }
    return this.getForRrhh(solicitudId);
  }
}
