import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth to inject req.user
vi.mock('../src/middlewares/authMiddleware', () => ({
  authenticateJWT: ((req: any, _res: any, next: any) => {
    req.user = {
      id: 99,
      nombre: 'Test',
      apellido: null,
      correoElectronico: null,
      departamentoId: 1,
      rolId: 2,
    };
    next();
  }) as any,
}));

// Mock service used by controller
import { RegistroDiarioService } from '../src/services/RegistroDiarioService';
vi.mock('../src/services/RegistroDiarioService');

import registroDiarioRouter from '../src/routes/RegistroDiarioRoutes';

function appFactory() {
  const app = express();
  app.use(express.json());
  app.use('/api/registrodiario', registroDiarioRouter);
  return app;
}

describe('RegistroDiario routes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POST /api/registrodiario crea o actualiza un registro', async () => {
    const fake = { id: 1, empleadoId: 99, fecha: '2025-09-04', actividades: [] } as any;
    (RegistroDiarioService.upsertRegistro as any).mockResolvedValue(fake);

    const app = appFactory();
    const payload = {
      fecha: '2025-09-04',
      horaEntrada: new Date('2025-09-04T07:00:00'),
      horaSalida: new Date('2025-09-04T19:00:00'),
      actividades: [],
    };

    const res = await request(app).post('/api/registrodiario').send(payload).expect(201);
    expect(res.body.success).toBe(true);
    expect(RegistroDiarioService.upsertRegistro).toHaveBeenCalled();
  });

  it('POST /api/registrodiario valida fecha inválida', async () => {
    const app = appFactory();
    const res = await request(app)
      .post('/api/registrodiario')
      .send({ fecha: '04/09/2025' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});

