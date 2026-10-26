import { Prisma, TipoSolicitudPermiso } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { DiaSolicitudInput } from "../dtos/solicitudPermiso.dto";

type Db = Prisma.TransactionClient | typeof prisma;

const empleadoSelect = {
  id: true,
  codigo: true,
  nombre: true,
  apellido: true,
  departamento: {
    select: {
      nombre: true,
      empresaId: true,
      empresa: { select: { nombre: true } },
    },
  },
} satisfies Prisma.EmpleadoSelect;

const solicitudInclude = {
  empleadoSolicitante: { select: empleadoSelect },
} satisfies Prisma.SolicitudPermisoInclude;

export type SolicitudPermisoRow = Prisma.SolicitudPermisoGetPayload<{
  include: typeof solicitudInclude;
}>;

/** Solicitud vigente: no eliminada y sin rechazo de supervisor ni de RRHH. */
export function whereSolicitudVigente(
  extra: Prisma.SolicitudPermisoWhereInput = {}
): Prisma.SolicitudPermisoWhereInput {
  return {
    ...extra,
    deletedAt: null,
    AND: [
      {
        OR: [{ aprobacionSupervisor: null }, { aprobacionSupervisor: true }],
      },
      { OR: [{ aprobacionRrhh: null }, { aprobacionRrhh: true }] },
    ],
  };
}

function cleanHorario(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class SolicitudPermisoRepository {
  static include = solicitudInclude;

  static async findById(id: number): Promise<SolicitudPermisoRow | null> {
    return prisma.solicitudPermiso.findFirst({
      where: { id, deletedAt: null },
      include: solicitudInclude,
    });
  }

  static async findByIds(ids: number[]): Promise<SolicitudPermisoRow[]> {
    if (ids.length === 0) return [];
    return prisma.solicitudPermiso.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: solicitudInclude,
    });
  }

  static async count(
    where: Prisma.SolicitudPermisoWhereInput
  ): Promise<number> {
    return prisma.solicitudPermiso.count({ where });
  }

  static async resumenDias(solicitudIds: number[]) {
    if (solicitudIds.length === 0) return [];
    return prisma.solicitudPermisoDia.groupBy({
      by: ["solicitudId"],
      where: { solicitudId: { in: solicitudIds } },
      _count: { _all: true },
      _min: { fecha: true },
      _max: { fecha: true },
    });
  }

  static async listDias(solicitudId: number, skip: number, take: number) {
    const where = { solicitudId };
    const [total, items] = await Promise.all([
      prisma.solicitudPermisoDia.count({ where }),
      prisma.solicitudPermisoDia.findMany({
        where,
        orderBy: { fecha: "asc" },
        skip,
        take,
        select: { id: true, fecha: true, comentarioHorario: true },
      }),
    ]);
    return { total, items };
  }

  static async listPropias(
    empleadoId: number,
    skip: number,
    take: number
  ): Promise<{ total: number; ids: number[] }> {
    const where: Prisma.SolicitudPermisoWhereInput = {
      empleadoSolicitanteId: empleadoId,
      deletedAt: null,
    };
    const [total, rows] = await Promise.all([
      prisma.solicitudPermiso.count({ where }),
      prisma.solicitudPermiso.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        select: { id: true },
      }),
    ]);
    return { total, ids: rows.map((row) => row.id) };
  }

  static async listSupervisionIds(
    teamIds: number[],
    skip: number,
    take: number
  ): Promise<number[]> {
    if (teamIds.length === 0) return [];
    const safeSkip = Math.max(0, Math.trunc(skip));
    const safeTake = Math.min(100, Math.max(1, Math.trunc(take)));
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT s.id
      FROM solicitudes_permisos s
      WHERE s.deleted_at IS NULL
        AND s.empleado_solicitante_id IN (${Prisma.join(teamIds)})
      ORDER BY (s.aprobacion_supervisor IS NULL) DESC, s.created_at DESC, s.id DESC
      LIMIT ${Prisma.raw(String(safeTake))} OFFSET ${Prisma.raw(String(safeSkip))}
    `;
    return rows.map((row) => Number(row.id));
  }

  static async listRrhhIds(
    empresaId: number,
    skip: number,
    take: number
  ): Promise<number[]> {
    const safeSkip = Math.max(0, Math.trunc(skip));
    const safeTake = Math.min(100, Math.max(1, Math.trunc(take)));
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT s.id
      FROM solicitudes_permisos s
      INNER JOIN empleados e ON e.id = s.empleado_solicitante_id
      INNER JOIN departamentos d ON d.id = e.departamento_id
      WHERE s.deleted_at IS NULL
        AND s.aprobacion_supervisor = TRUE
        AND d.empresa_id = ${empresaId}
      ORDER BY (s.aprobacion_rrhh IS NULL) DESC, s.created_at DESC, s.id DESC
      LIMIT ${Prisma.raw(String(safeTake))} OFFSET ${Prisma.raw(String(safeSkip))}
    `;
    return rows.map((row) => Number(row.id));
  }

  static async fechasOcupadas(
    db: Db,
    empleadoId: number,
    fechas: string[],
    excludeSolicitudId?: number
  ): Promise<string[]> {
    if (fechas.length === 0) return [];
    const rows = await db.solicitudPermisoDia.findMany({
      where: {
        fecha: { in: fechas },
        solicitud: whereSolicitudVigente({
          empleadoSolicitanteId: empleadoId,
          ...(excludeSolicitudId
            ? { id: { not: excludeSolicitudId } }
            : {}),
        }),
      },
      select: { fecha: true },
      distinct: ["fecha"],
    });
    return rows.map((row) => row.fecha);
  }

  static async create(
    db: Db,
    empleadoId: number,
    tipo: TipoSolicitudPermiso,
    comentario: string | null,
    dias: DiaSolicitudInput[]
  ): Promise<SolicitudPermisoRow> {
    return db.solicitudPermiso.create({
      data: {
        empleadoSolicitanteId: empleadoId,
        tipo,
        comentario,
        updatedBy: empleadoId,
        dias: {
          create: dias.map((dia) => ({
            fecha: dia.fecha,
            comentarioHorario: cleanHorario(dia.comentarioHorario),
          })),
        },
      },
      include: solicitudInclude,
    });
  }

  static async replace(
    db: Db,
    id: number,
    empleadoId: number,
    tipo: TipoSolicitudPermiso,
    comentario: string | null,
    dias: DiaSolicitudInput[]
  ): Promise<SolicitudPermisoRow> {
    await db.solicitudPermisoDia.deleteMany({ where: { solicitudId: id } });
    return db.solicitudPermiso.update({
      where: { id },
      data: {
        tipo,
        comentario,
        updatedAt: new Date(),
        updatedBy: empleadoId,
        dias: {
          create: dias.map((dia) => ({
            fecha: dia.fecha,
            comentarioHorario: cleanHorario(dia.comentarioHorario),
          })),
        },
      },
      include: solicitudInclude,
    });
  }

  static async softDelete(id: number, empleadoId: number) {
    return prisma.solicitudPermiso.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: empleadoId,
      },
    });
  }

  static async decidirSupervisor(
    id: number,
    supervisorId: number,
    aprobado: boolean,
    comentario: string | null
  ) {
    return prisma.solicitudPermiso.update({
      where: { id },
      data: {
        aprobacionSupervisor: aprobado,
        comentarioSupervisor: comentario,
        aprobadorSupervisorId: supervisorId,
        fechaAprobacionSupervisor: new Date(),
        updatedAt: new Date(),
        updatedBy: supervisorId,
      },
      include: solicitudInclude,
    });
  }

  static async decidirRrhh(
    id: number,
    rrhhId: number,
    aprobado: boolean,
    comentario: string | null
  ) {
    return prisma.solicitudPermiso.update({
      where: { id },
      data: {
        aprobacionRrhh: aprobado,
        comentarioRrhh: comentario,
        aprobadorRrhhId: rrhhId,
        fechaAprobacionRrhh: new Date(),
        updatedAt: new Date(),
        updatedBy: rrhhId,
      },
      include: solicitudInclude,
    });
  }

  static async marcasCalendario(
    empleadoIds: number[],
    desde: string,
    hasta: string
  ) {
    if (empleadoIds.length === 0) return [];
    return prisma.solicitudPermisoDia.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        solicitud: whereSolicitudVigente({
          empleadoSolicitanteId: { in: empleadoIds },
        }),
      },
      select: {
        fecha: true,
        solicitud: {
          select: {
            aprobacionSupervisor: true,
            aprobacionRrhh: true,
          },
        },
      },
    });
  }

  static async ocupacionDia(
    empleadoIds: number[],
    fecha: string,
    skip: number,
    take: number
  ) {
    const where: Prisma.SolicitudPermisoDiaWhereInput = {
      fecha,
      solicitud: whereSolicitudVigente({
        empleadoSolicitanteId: { in: empleadoIds },
      }),
    };
    const [total, items] = await Promise.all([
      prisma.solicitudPermisoDia.count({ where }),
      prisma.solicitudPermisoDia.findMany({
        where,
        skip,
        take,
        orderBy: { id: "asc" },
        select: {
          comentarioHorario: true,
          solicitud: {
            select: {
              id: true,
              tipo: true,
              aprobacionSupervisor: true,
              aprobacionRrhh: true,
              empleadoSolicitante: { select: empleadoSelect },
            },
          },
        },
      }),
    ]);
    return { total, items };
  }

  static async teamEmpleadoIds(
    supervisorId: number,
    departamentoId: number
  ): Promise<number[]> {
    const [departamento, accesos] = await Promise.all([
      prisma.empleado.findMany({
        where: { departamentoId, deletedAt: null },
        select: { id: true },
      }),
      prisma.planillaAcceso.findMany({
        where: { supervisorId, deletedAt: null },
        select: { empleadoId: true },
      }),
    ]);
    return [
      ...new Set([
        ...departamento.map((row) => row.id),
        ...accesos.map((row) => row.empleadoId),
      ]),
    ];
  }
}
