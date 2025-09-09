import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth to inject req.user
vi.mock('../src/middlewares/authMiddleware', () => ({
  authenticateJWT: ((req: any, _res: any, next: any) => {
    req.user = {
      id: 101,
      nombre: 'Test',
      apellido: null,
      correoElectronico: null,
      departamentoId: 1,
      rolId: 2,
    };
    next();
  }) as any,
}));

// Mock domain used by controller
import * as Domain from '../src/domain/calculo-horas/horario-trabajo-domain';
vi.mock('../src/domain/calculo-horas/horario-trabajo-domain');

import { buildTestApp } from './helpers/app';

describe('calculoHorasTrabajo routes', () => {
  const app = buildTestApp();
  beforeEach(() => vi.restoreAllMocks());

  it('GET /:empleadoId/horario/:fecha -> 200 OK', async () => {
    (Domain.HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado as any).mockResolvedValue({
      tipoHorario: 'H1',
      fecha: '2025-09-05',
      empleadoId: '101',
      horarioTrabajo: { inicio: '07:00', fin: '17:00' },
      incluyeAlmuerzo: true,
      esDiaLibre: false,
      esFestivo: false,
      nombreDiaFestivo: '',
      cantidadHorasLaborables: 9,
    });

    const res = await request(app)
      .get('/api/calculo-horas/101/horario/2025-09-05')
      .set('Authorization', 'Bearer dummy')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data?.tipoHorario).toBe('H1');
  });

  it('GET /:empleadoId/horario/:fecha -> 400 por fecha inválida', async () => {
    const res = await request(app)
      .get('/api/calculo-horas/101/horario/05-09-2025')
      .set('Authorization', 'Bearer dummy')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/horario/:fecha -> 404 cuando no encontrado', async () => {
    (Domain.HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado as any).mockRejectedValue(
      new Error('Empleado con ID 101 no encontrado')
    );
    const res = await request(app)
      .get('/api/calculo-horas/101/horario/2025-09-05')
      .set('Authorization', 'Bearer dummy')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/horario/:fecha -> 422 por validaciones/cuadre', async () => {
    (Domain.HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado as any).mockRejectedValue(
      new Error('cuadre')
    );
    const res = await request(app)
      .get('/api/calculo-horas/101/horario/2025-09-05')
      .set('Authorization', 'Bearer dummy')
      .expect(422);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/conteo-horas -> 200 OK', async () => {
    (Domain.HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado as any).mockResolvedValue({
      fechaInicio: '2025-09-01',
      fechaFin: '2025-09-07',
      empleadoId: '101',
      cantidadHoras: { normal: 45, p25: 2, p50: 1, p75: 0, p100: 0, libre: 90, almuerzo: 5 },
    });

    const res = await request(app)
      .get('/api/calculo-horas/101/conteo-horas')
      .query({ fechaInicio: '2025-09-01', fechaFin: '2025-09-07' })
      .set('Authorization', 'Bearer dummy')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.cantidadHoras?.normal).toBe(45);
  });

  it('GET /:empleadoId/conteo-horas -> 400 por parámetros inválidos', async () => {
    const res = await request(app)
      .get('/api/calculo-horas/101/conteo-horas')
      .query({ fechaInicio: '2025/09/01', fechaFin: '2025-09-07' })
      .set('Authorization', 'Bearer dummy')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/conteo-horas -> 400 por rango invertido', async () => {
    const res = await request(app)
      .get('/api/calculo-horas/101/conteo-horas')
      .query({ fechaInicio: '2025-09-08', fechaFin: '2025-09-07' })
      .set('Authorization', 'Bearer dummy')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/conteo-horas -> 404 cuando no encontrado', async () => {
    (Domain.HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado as any).mockRejectedValue(
      new Error('Empleado no encontrado')
    );
    const res = await request(app)
      .get('/api/calculo-horas/101/conteo-horas')
      .query({ fechaInicio: '2025-09-01', fechaFin: '2025-09-07' })
      .set('Authorization', 'Bearer dummy')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /:empleadoId/conteo-horas -> 422 por validación', async () => {
    (Domain.HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado as any).mockRejectedValue(
      new Error('Validación de cuadre fallida')
    );
    const res = await request(app)
      .get('/api/calculo-horas/101/conteo-horas')
      .query({ fechaInicio: '2025-09-01', fechaFin: '2025-09-07' })
      .set('Authorization', 'Bearer dummy')
      .expect(422);
    expect(res.body.success).toBe(false);
  });
});
