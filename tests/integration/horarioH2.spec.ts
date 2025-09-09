import { describe, it, expect, beforeAll } from 'vitest';
const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
import { PrismaClient, TipoHorario } from '@prisma/client';
import { HorarioTrabajoDomain } from '../../src/domain/calculo-horas/horario-trabajo-domain';
import { RegistroDiarioRepository } from '../../src/repositories/RegistroDiarioRepository';

// Use a fresh Prisma client for tests
const prisma = new PrismaClient();

async function ensureBaseRefs() {
  // Empresa + Departamento
  let empresa = await prisma.empresa.findFirst({ where: { deletedAt: null } });
  if (!empresa) {
    empresa = await prisma.empresa.create({ data: { nombre: 'TestCo' } });
  }
  let dept = await prisma.departamento.findFirst({ where: { empresaId: empresa.id, deletedAt: null } });
  if (!dept) {
    dept = await prisma.departamento.create({
      data: {
        empresaId: empresa.id,
        nombre: 'TestDept',
        codigo: 'TEST',
      },
    });
  }

  // Rol Empleado (id manual en schema; si no existe, crea uno)
  let rol = await prisma.rol.findFirst({ where: { nombre: 'Empleado' } });
  if (!rol) {
    // Use a high ID to avoid conflicts with seed
    rol = await prisma.rol.create({ data: { id: 1001, nombre: 'Empleado' } });
  }

  // Job
  let job = await prisma.job.findFirst({ where: { empresaId: empresa.id, deletedAt: null } });
  if (!job) {
    job = await prisma.job.create({
      data: {
        nombre: 'Test Job',
        codigo: 'TJOB',
        descripcion: 'Job para pruebas',
        activo: true,
        especial: false,
        empresaId: empresa.id,
        mostrarEmpresaId: empresa.id,
      },
    });
  }

  return { empresa, dept, rol, job };
}

async function createEmpleadoH2() {
  const { dept, rol } = await ensureBaseRefs();
  const now = Date.now();
  const empleado = await prisma.empleado.create({
    data: {
      nombre: 'Empleado H2',
      apellido: 'Test',
      nombreUsuario: `user${now}`.slice(0, 15),
      codigo: `EMP${now}`.slice(0, 20),
      correoElectronico: `emp${now}@test.local`,
      departamentoId: dept.id,
      rolId: rol.id,
      tipoHorario: TipoHorario.H2,
      activo: true,
    },
    select: { id: true },
  });
  return empleado.id;
}

describeDb('Integración: H2 conteo de horas', () => {
  let empleadoId: number;
  let jobId: number;

  beforeAll(async () => {
    const base = await ensureBaseRefs();
    empleadoId = await createEmpleadoH2();
    jobId = base.job.id;
  });

  it('07:00-19:00 debe contar 12h NORMAL y sin almuerzo', async () => {
    const fecha = '2025-09-04';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T19:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false, // H2 fuerza hora corrida internamente
      actividades: [
        {
          jobId,
          descripcion: 'Jornada normal',
          duracionHoras: 12,
          esExtra: false,
        },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
      fecha,
      fecha,
      String(empleadoId)
    );

    expect(conteo.cantidadHoras.normal).toBe(12);
    expect(conteo.cantidadHoras.p25).toBe(0);
    expect(conteo.cantidadHoras.almuerzo).toBe(0);
    expect(conteo.cantidadHoras.libre).toBe(12);
  });

  it('Extra 19:00-21:00 suma 2h p25 manteniendo 12h normal', async () => {
    const fecha = '2025-09-05';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T19:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        {
          jobId,
          descripcion: 'Jornada normal',
          duracionHoras: 12,
          esExtra: false,
        },
        {
          jobId,
          descripcion: 'Extra post turno',
          esExtra: true,
          duracionHoras: 2,
          horaInicio: new Date(`${fecha}T19:00:00-06:00`),
          horaFin: new Date(`${fecha}T21:00:00-06:00`),
        },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
      fecha,
      fecha,
      String(empleadoId)
    );
    expect(conteo.cantidadHoras.normal).toBe(12);
    expect(conteo.cantidadHoras.p25).toBe(2);
    expect(conteo.cantidadHoras.almuerzo).toBe(0);
  });

  it('Extra antes del turno (05:00-07:00) suma 2h p25', async () => {
    const fecha = '2025-09-07';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T19:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        {
          jobId,
          descripcion: 'Extra pre turno',
          esExtra: true,
          duracionHoras: 2,
          horaInicio: new Date(`${fecha}T05:00:00-06:00`),
          horaFin: new Date(`${fecha}T07:00:00-06:00`),
        },
        {
          jobId,
          descripcion: 'Jornada normal',
          esExtra: false,
          duracionHoras: 12,
        },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
      fecha,
      fecha,
      String(empleadoId)
    );
    expect(conteo.cantidadHoras.normal).toBe(12);
    expect(conteo.cantidadHoras.p25).toBe(2);
    expect(conteo.cantidadHoras.almuerzo).toBe(0);
  });

  it('Día libre (esDiaLibre=true) cuenta 24h LIBRE', async () => {
    const fecha = '2025-09-08';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T00:00:00-06:00`),
      horaSalida: new Date(`${fecha}T00:00:00-06:00`),
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
      fecha,
      fecha,
      String(empleadoId)
    );
    expect(conteo.cantidadHoras.normal).toBe(0);
    expect(conteo.cantidadHoras.p25).toBe(0);
    expect(conteo.cantidadHoras.libre).toBe(24);
  });

  it('Nocturno 19:00-07:00 día Lunes: 12h NORMAL', async () => {
    const fecha = '2025-09-01'; // Lunes
    const salida = '2025-09-02';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T19:00:00-06:00`),
      horaSalida: new Date(`${salida}T07:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Turno nocturno', esExtra: false, duracionHoras: 12 },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
      fecha,
      fecha,
      String(empleadoId)
    );
    expect(conteo.cantidadHoras.normal).toBe(12);
    expect(conteo.cantidadHoras.p25).toBe(0);
  });

  it('Nocturno 19:00-07:00 día Martes: valida regla especial (espera error)', async () => {
    const fecha = '2025-09-02'; // Martes
    const salida = '2025-09-03';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T19:00:00-06:00`),
      horaSalida: new Date(`${salida}T07:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Turno nocturno', esExtra: false, duracionHoras: 12 },
      ],
    });

    await expect(
      HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
        fecha,
        fecha,
        String(empleadoId)
      )
    ).rejects.toThrow(/NORMAL_NO_COINCIDE_CON_INTERVALO/);
  });

  it('EXTRA dentro del rango NORMAL debe lanzar error', async () => {
    const fecha = '2025-09-09';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T19:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 12 },
        {
          jobId,
          descripcion: 'Extra mal ubicada',
          esExtra: true,
          duracionHoras: 2,
          horaInicio: new Date(`${fecha}T08:00:00-06:00`),
          horaFin: new Date(`${fecha}T10:00:00-06:00`),
        },
      ],
    });

    await expect(
      HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
        fecha,
        fecha,
        String(empleadoId)
      )
    ).rejects.toThrow(/EXTRA_DENTRO_DE_NORMAL/);
  });
});
