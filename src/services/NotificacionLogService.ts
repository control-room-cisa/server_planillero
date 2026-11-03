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
    filters: { soloNoLeidas?: boolean; categoria?: string } = {}
  ): Promise<PaginatedDto<NotificacionLogDto>> {
    const skip = (page - 1) * limit;
    const { total, items } = await NotificacionLogRepository.listByDestinatario(
      destinatarioId,
      {
        skip,
        take: limit,
        soloNoLeidas: filters.soloNoLeidas,
        categoria: filters.categoria,
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

  static async countNoLeidas(destinatarioId: number): Promise<number> {
    return NotificacionLogRepository.countNoLeidas(destinatarioId);
  }
}
