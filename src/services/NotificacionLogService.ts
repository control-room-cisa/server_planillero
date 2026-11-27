import type {
  CreateNotificacionLogInput,
  NotificacionLogDto,
  PaginatedDto,
} from "../dtos/notificacionLog.dto";
import { AppError } from "../errors/AppError";
import {
  NotificacionLogRepository,
  type NotificacionLogRow,
} from "../repositories/NotificacionLogRepository";
import type { Prisma } from "@prisma/client";
import { Roles } from "../enums/roles";
import { hasAnyRole } from "../utils/roles";
import { NotificacionCategorias } from "../enums/notificacionCategorias";

/** CAMBIO_JOB/CLASS solo visibles para rol supervisor (no colaborador). */
const CATEGORIAS_SOLO_SUPERVISOR: string[] = [
  NotificacionCategorias.CAMBIO_JOB,
  NotificacionCategorias.CAMBIO_CLASS,
];

function excluirCategoriasParaRoles(rolIds: number[] | undefined): string[] {
  if (hasAnyRole(rolIds, Roles.SUPERVISOR)) return [];
  return CATEGORIAS_SOLO_SUPERVISOR;
}

function toDto(row: NotificacionLogRow): NotificacionLogDto {
  return {
    id: row.id,
    categoria: row.categoria,
    descripcion: row.descripcion,
    leida: row.leida,
    leidaAt: row.leidaAt,
    metadata: row.metadata,
    createdAt: row.createdAt,
    destinatario: {
      id: row.destinatario.id,
      codigo: row.destinatario.codigo,
      nombre: row.destinatario.nombre,
      apellido: row.destinatario.apellido,
    },
    actor: row.actor
      ? {
          id: row.actor.id,
          codigo: row.actor.codigo,
          nombre: row.actor.nombre,
          apellido: row.actor.apellido,
        }
      : null,
  };
}

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export { NotificacionCategorias } from "../enums/notificacionCategorias";

export class NotificacionLogService {
  static async create(
    input: CreateNotificacionLogInput,
    db?: Prisma.TransactionClient
  ): Promise<NotificacionLogDto> {
    const row = await NotificacionLogRepository.create(input, db);
    return toDto(row);
  }

  static async listMias(
    destinatarioId: number,
    page: number,
    limit: number,
    filters: { soloNoLeidas?: boolean; categoria?: string } = {},
    rolIds?: number[]
  ): Promise<PaginatedDto<NotificacionLogDto>> {
    const skip = (page - 1) * limit;
    const { total, items } = await NotificacionLogRepository.listByDestinatario(
      destinatarioId,
      {
        skip,
        take: limit,
        soloNoLeidas: filters.soloNoLeidas,
        categoria: filters.categoria,
        excluirCategorias: excluirCategoriasParaRoles(rolIds),
      }
    );
    return {
      items: items.map(toDto),
      pagination: pagination(page, limit, total),
    };
  }

  static async marcarLeida(
    destinatarioId: number,
    id: number
  ): Promise<NotificacionLogDto> {
    const row = await NotificacionLogRepository.marcarLeida(id, destinatarioId);
    if (!row) {
      throw new AppError("Notificación no encontrada", 404);
    }
    return toDto(row);
  }

  static async countNoLeidas(
    destinatarioId: number,
    rolIds?: number[]
  ): Promise<number> {
    return NotificacionLogRepository.countNoLeidas(destinatarioId, {
      excluirCategorias: excluirCategoriasParaRoles(rolIds),
    });
  }
}
