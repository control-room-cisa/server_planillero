import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistroDiarioService } from '../src/services/RegistroDiarioService';
import * as Repo from '../src/repositories/RegistroDiarioRepository';

describe('RegistroDiarioService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('upsertRegistro delega al repositorio con empleadoId y dto', async () => {
    const fake = {
      id: 1,
      empleadoId: 10,
      fecha: '2025-09-04',
      horaEntrada: new Date('2025-09-04T07:00:00'),
      horaSalida: new Date('2025-09-04T19:00:00'),
      actividades: [],
    } as any;

    const spy = vi
      .spyOn(Repo.RegistroDiarioRepository, 'upsertWithActivities')
      .mockResolvedValue(fake);

    const dto = {
      fecha: '2025-09-04',
      horaEntrada: new Date('2025-09-04T07:00:00'),
      horaSalida: new Date('2025-09-04T19:00:00'),
      actividades: [],
    } as any;

    const res = await RegistroDiarioService.upsertRegistro(10, dto);
    expect(spy).toHaveBeenCalledWith({ empleadoId: 10, ...dto });
    expect(res).toBe(fake);
  });

  it('getByDate delega a findByEmpleadoAndDateWithActivities', async () => {
    const fake = { id: 2 } as any;
    const spy = vi
      .spyOn(Repo.RegistroDiarioRepository, 'findByEmpleadoAndDateWithActivities')
      .mockResolvedValue(fake);

    const res = await RegistroDiarioService.getByDate(5, '2025-09-04');
    expect(spy).toHaveBeenCalledWith(5, '2025-09-04');
    expect(res).toBe(fake);
  });
});

