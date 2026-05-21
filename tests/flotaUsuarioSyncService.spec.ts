import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chunkArray } from "../src/utils/chunkArray";

describe("FlotaUsuarioSyncService — chunking para cron", () => {
  it("501 usuarios generan 2 lotes de 500 y 1", () => {
    const usuarios = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    const chunks = chunkArray(usuarios, 500);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(1);
  });
});

describe("FlotaUsuarioSyncService — POST al webhook", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FLOTA_WEBHOOK_SYNC_URL =
      "http://127.0.0.1:3001/api/webhooks/usuarios/sync";
    process.env.FLOTA_WEBHOOK_SYNC_SECRET = "test-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("loguea creados/actualizados cuando el webhook responde success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "OK",
        data: {
          creados: 2,
          actualizados: 3,
          errores: [
            { codigo_empleado: "EMP099", mensaje: "Empresa no existe" },
          ],
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { FlotaUsuarioSyncService } =
      await import("../src/services/FlotaUsuarioSyncService");

    const prismaMock = await import("../src/config/prisma");
    vi.spyOn(prismaMock.prisma.empleado, "findFirst").mockResolvedValue({
      id: 1,
      codigo: "EMP001",
      nombre: "Juan",
      apellido: "Pérez",
      contrasena: "$2b$10$hash",
      nombreUsuario: "jperez",
      correoElectronico: "juan@test.com",
      departamentoId: 1,
      rolId: 1,
      activo: true,
      departamento: {
        id: 1,
        empresaId: 1,
        nombre: "Dep",
        codigo: null,
        createdAt: null,
        updatedAt: null,
        deletedAt: null,
        empresa: { codigo: "EC01" },
      },
    } as never);

    await FlotaUsuarioSyncService.syncOne(1);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-Webhook-Key"]).toBe(
      "test-secret",
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("creados=2 actualizados=3 errores=1"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("EMP099: Empresa no existe"),
    );
  });
});

describe("FlotaUsuarioSyncService — sin configuración de webhook", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("no llama fetch si faltan variables de entorno", async () => {
    vi.stubEnv("FLOTA_WEBHOOK_SYNC_URL", "");
    vi.stubEnv("FLOTA_WEBHOOK_SYNC_SECRET", "");

    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.resetModules();
    const { FlotaUsuarioSyncService } =
      await import("../src/services/FlotaUsuarioSyncService");

    const prismaMock = await import("../src/config/prisma");
    const findFirstSpy = vi
      .spyOn(prismaMock.prisma.empleado, "findFirst")
      .mockResolvedValue(null as never);

    await FlotaUsuarioSyncService.syncOne(1);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(findFirstSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("configurar FLOTA_WEBHOOK_SYNC_URL"),
    );
  });
});
