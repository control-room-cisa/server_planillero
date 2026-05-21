import { prisma } from "../config/prisma";
import {
  mapEmpleadoToFlotaUsuario,
  type FlotaUsuarioPayload,
} from "../integrations/flotaUsuarioMapper";
import { chunkArray } from "../utils/chunkArray";

const BATCH_SIZE = 500;
const DEBOUNCE_MS = 400;

interface FlotaSyncError {
  codigo_empleado: string;
  mensaje: string;
}

interface FlotaSyncResponse {
  success: boolean;
  message?: string;
  data?: {
    total?: number;
    creados?: number;
    actualizados?: number;
    errores?: FlotaSyncError[];
  };
}

const pendingSyncs = new Map<number, ReturnType<typeof setTimeout>>();

function getWebhookUrl(): string | null {
  return process.env.FLOTA_WEBHOOK_SYNC_URL?.trim() || null;
}

function getWebhookSecret(): string | null {
  return process.env.FLOTA_WEBHOOK_SYNC_SECRET?.trim() || null;
}

function logSyncResult(
  context: string,
  chunkIndex: number,
  totalChunks: number,
  data: FlotaSyncResponse
): void {
  if (!data.success) {
    console.error(
      `[FlotaSync] ${context} chunk ${chunkIndex + 1}/${totalChunks}: ${data.message ?? "Error desconocido"}`
    );
    return;
  }

  const creados = data.data?.creados ?? 0;
  const actualizados = data.data?.actualizados ?? 0;
  const errores = data.data?.errores ?? [];

  console.log(
    `[FlotaSync] ${context} chunk ${chunkIndex + 1}/${totalChunks}: creados=${creados} actualizados=${actualizados} errores=${errores.length}`
  );

  for (const err of errores) {
    console.warn(
      `[FlotaSync] ${err.codigo_empleado}: ${err.mensaje}`
    );
  }
}

export class FlotaUsuarioSyncService {
  /**
   * Programa sync de un empleado con debounce (evita doble POST en create+update de archivos).
   */
  static scheduleSyncOne(empleadoId: number): void {
    const existing = pendingSyncs.get(empleadoId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      pendingSyncs.delete(empleadoId);
      void this.syncOne(empleadoId);
    }, DEBOUNCE_MS);

    pendingSyncs.set(empleadoId, timeout);
  }

  static async syncOne(empleadoId: number): Promise<void> {
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      console.warn(
        "[FlotaSync] Omitido: configurar FLOTA_WEBHOOK_SYNC_URL y FLOTA_WEBHOOK_SYNC_SECRET en .env"
      );
      return;
    }

    const empleado = await prisma.empleado.findFirst({
      where: { id: empleadoId, deletedAt: null },
      include: {
        departamento: {
          include: {
            empresa: { select: { codigo: true } },
          },
        },
      },
    });

    if (!empleado) {
      console.warn(`[FlotaSync] Empleado ${empleadoId} no encontrado o eliminado`);
      return;
    }

    const usuario = mapEmpleadoToFlotaUsuario(empleado);
    if (!usuario) {
      console.warn(
        `[FlotaSync] Empleado ${empleadoId} omitido: falta codigo o contrasena`
      );
      return;
    }

    await this.postUsuarios(url, secret, [usuario], "syncOne");
  }

  static async syncAllInBatches(): Promise<void> {
    const url = getWebhookUrl();
    const secret = getWebhookSecret();

    if (!url || !secret) {
      console.error(
        "[FlotaSync] Cron omitido: configurar FLOTA_WEBHOOK_SYNC_URL y FLOTA_WEBHOOK_SYNC_SECRET en .env"
      );
      return;
    }

    const empleados = await prisma.empleado.findMany({
      where: { deletedAt: null },
      include: {
        departamento: {
          include: {
            empresa: { select: { codigo: true } },
          },
        },
      },
    });

    const usuarios: FlotaUsuarioPayload[] = [];
    for (const emp of empleados) {
      const mapped = mapEmpleadoToFlotaUsuario(emp);
      if (mapped) {
        usuarios.push(mapped);
      } else {
        console.warn(
          `[FlotaSync] Cron: empleado id=${emp.id} omitido (sin codigo o contrasena)`
        );
      }
    }

    if (usuarios.length === 0) {
      console.warn("[FlotaSync] Cron: no hay usuarios válidos para sincronizar");
      return;
    }

    const chunks = chunkArray(usuarios, BATCH_SIZE);
    console.log(
      `[FlotaSync] Cron: sincronizando ${usuarios.length} usuarios en ${chunks.length} lote(s)`
    );

    for (let i = 0; i < chunks.length; i++) {
      await this.postUsuarios(url, secret, chunks[i], "cron", i, chunks.length);
    }
  }

  private static async postUsuarios(
    url: string,
    secret: string,
    usuarios: FlotaUsuarioPayload[],
    context: string,
    chunkIndex = 0,
    totalChunks = 1
  ): Promise<void> {
    if (usuarios.length === 0) return;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Key": secret,
        },
        body: JSON.stringify({ data: { usuarios } }),
      });

      let body: FlotaSyncResponse;
      try {
        body = (await response.json()) as FlotaSyncResponse;
      } catch {
        console.error(
          `[FlotaSync] ${context}: respuesta no JSON (HTTP ${response.status})`
        );
        return;
      }

      if (!response.ok) {
        console.error(
          `[FlotaSync] ${context}: HTTP ${response.status} — ${body.message ?? "Error"}`
        );
        return;
      }

      logSyncResult(context, chunkIndex, totalChunks, body);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[FlotaSync] ${context}: error de red — ${msg}`);
    }
  }
}
