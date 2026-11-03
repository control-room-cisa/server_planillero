import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { CreateNotificacionLogInput } from "../dtos/notificacionLog.dto";

type Db = Prisma.TransactionClient | typeof prisma;

const empleadoSelect = {
  id: true,
  codigo: true,
  nombre: true,
  apellido: true,
} satisfies Prisma.EmpleadoSelect;

const notificacionInclude = {
  destinatario: { select: empleadoSelect },
  actor: { select: empleadoSelect },
} satisfies Prisma.NotificacionLogInclude;

export type NotificacionLogRow = Prisma.NotificacionLogGetPayload<{
  include: typeof notificacionInclude;
}>;

export class NotificacionLogRepository {
  static async create(
    input: CreateNotificacionLogInput,
    db: Db = prisma
  ): Promise<NotificacionLogRow> {
    return db.notificacionLog.create({
      data: {
        destinatarioId: input.destinatarioId,
        actorId: input.actorId ?? null,
        categoria: input.categoria,
        descripcion: input.descripcion.slice(0, 500),
        metadata:
          input.metadata === undefined
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
      },
      include: notificacionInclude,
    });
  }

  static async findByIdForDestinatario(
    id: number,
    destinatarioId: number
  ): Promise<NotificacionLogRow | null> {
    return prisma.notificacionLog.findFirst({
      where: { id, destinatarioId },
      include: notificacionInclude,
    });
  }

  static async listByDestinatario(
    destinatarioId: number,
    options: {
      skip: number;
      take: number;
      soloNoLeidas?: boolean;
      categoria?: string;
    }
  ): Promise<{ total: number; items: NotificacionLogRow[] }> {
    const where: Prisma.NotificacionLogWhereInput = {
      destinatarioId,
      ...(options.soloNoLeidas ? { leida: false } : {}),
      ...(options.categoria ? { categoria: options.categoria } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.notificacionLog.count({ where }),
      prisma.notificacionLog.findMany({
        where,
        include: notificacionInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: options.skip,
        take: options.take,
      }),
    ]);
    return { total, items };
  }

  static async marcarLeida(
    id: number,
    destinatarioId: number
  ): Promise<NotificacionLogRow | null> {
    const existing = await this.findByIdForDestinatario(id, destinatarioId);
    if (!existing) return null;
    if (existing.leida) return existing;
    return prisma.notificacionLog.update({
      where: { id },
      data: { leida: true, leidaAt: new Date() },
      include: notificacionInclude,
    });
  }

  static async countNoLeidas(destinatarioId: number): Promise<number> {
    return prisma.notificacionLog.count({
      where: { destinatarioId, leida: false },
    });
  }
}
