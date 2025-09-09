import { describe, it, expect, beforeAll } from 'vitest';
const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
import { PrismaClient, TipoHorario } from '@prisma/client';
import { HorarioTrabajoDomain } from '../../src/domain/calculo-horas/horario-trabajo-domain';
import { RegistroDiarioRepository } from '../../src/repositories/RegistroDiarioRepository';

const prisma = new PrismaClient();

async function ensureBaseRefs() {
  // Empresa + Departamento
  let empresa = await prisma.empresa.findFirst({ where: { deletedAt: null } });
  if (!empresa) empresa = await prisma.empresa.create({ data: { nombre: 'H1 Co' } });

  let dept = await prisma.departamento.findFirst({ where: { empresaId: empresa.id, deletedAt: null } });
  if (!dept) {
    dept = await prisma.departamento.create({ data: { empresaId: empresa.id, nombre: 'Ops', codigo: 'OPS' } });
  }

  // Rol
  let rol = await prisma.rol.findFirst({ where: { nombre: 'Empleado' } });
  if (!rol) rol = await prisma.rol.create({ data: { id: 1101, nombre: 'Empleado' } });

  // Jobs: normal y especial E02
  let job = await prisma.job.findFirst({ where: { empresaId: empresa.id, especial: false, deletedAt: null } });
  if (!job) {
    job = await prisma.job.create({
      data: {
        nombre: 'Job Normal', codigo: 'JNORM', descripcion: 'Normal', activo: true,
        especial: false, empresaId: empresa.id, mostrarEmpresaId: empresa.id,
      },
    });
  }
  let jobVac = await prisma.job.findFirst({ where: { codigo: 'E02', especial: true, deletedAt: null } });
  if (!jobVac) {
    jobVac = await prisma.job.create({
      data: {
        nombre: 'Vacaciones', codigo: 'E02', descripcion: 'Vacaciones', activo: true,
        especial: true, empresaId: empresa.id, mostrarEmpresaId: empresa.id,
      },
    });
  }
  return { empresa, dept, rol, job, jobVac };
}

async function ensureJobByCode(code: string, name: string) {
  let job = await prisma.job.findFirst({ where: { codigo: code, deletedAt: null } });
  if (!job) {
    const base = await ensureBaseRefs();
    job = await prisma.job.create({
      data: {
        nombre: name,
        codigo: code,
        descripcion: name,
        activo: true,
        especial: true,
        empresaId: base.empresa.id,
        mostrarEmpresaId: base.empresa.id,
      },
    });
  }
  return job.id;
}

async function ensureFeriado(fecha: string, nombre = 'Feriado Prueba') {
  const found = await prisma.feriado.findFirst({ where: { fecha } });
  if (!found) {
    await prisma.feriado.create({ data: { fecha, nombre, descripcion: 'Test' } });
  }
}

async function createEmpleadoH1() {
  const { dept, rol } = await ensureBaseRefs();
  const now = Date.now();
  const empleado = await prisma.empleado.create({
    data: {
      nombre: 'Empleado H1', apellido: 'Test',
      nombreUsuario: `eh1${now}`.slice(0, 15), codigo: `EH1${now}`.slice(0, 20),
      correoElectronico: `eh1${now}@test.local`, departamentoId: dept.id,
      rolId: rol.id, tipoHorario: TipoHorario.H1, activo: true,
    },
    select: { id: true },
  });
  return empleado.id;
}

describeDb('Integración: H1 conteo de horas', () => {
  let empleadoId: number;
  let jobId: number;
  let jobVacId: number;

  beforeAll(async () => {
    const base = await ensureBaseRefs();
    empleadoId = await createEmpleadoH1();
    jobId = base.job.id;
    jobVacId = base.jobVac.id;
  });

  it('Lunes 07:00-17:00 incluye 9h NORMAL + 1h ALMUERZO', async () => {
    const fecha = '2025-09-01'; // Lunes
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId, descripcion: 'Normal', duracionHoras: 8, esExtra: false } ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.normal).toBe(9);
    expect(conteo.cantidadHoras.almuerzo).toBe(1);
    expect(conteo.cantidadHoras.p25).toBe(0);
    expect(conteo.cantidadHoras.p50).toBe(0);
  });

  it('Viernes 07:00-16:00 incluye 8h NORMAL + 1h ALMUERZO', async () => {
    const fecha = '2025-09-05'; // Viernes
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T16:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId, descripcion: 'Normal', duracionHoras: 7, esExtra: false } ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.normal).toBe(8);
    expect(conteo.cantidadHoras.almuerzo).toBe(1);
  });

  it('Extra diurna 17:00-19:00 suma 2h p25', async () => {
    const fecha = '2025-09-02';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', duracionHoras: 8, esExtra: false },
        { jobId, descripcion: 'Extra diurna', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${fecha}T17:00:00-06:00`), horaFin: new Date(`${fecha}T19:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.p25).toBe(2);
    expect(conteo.cantidadHoras.p50).toBe(0);
    expect(conteo.cantidadHoras.p75).toBe(0);
  });

  it('Mixta 17:00-21:00: 2h p25 + 1h p50 + 1h p75', async () => {
    const fecha = '2025-09-03'; // Miércoles
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', duracionHoras: 8, esExtra: false },
        { jobId, descripcion: 'Extra continua', esExtra: true, duracionHoras: 4,
          horaInicio: new Date(`${fecha}T17:00:00-06:00`), horaFin: new Date(`${fecha}T21:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.p25).toBe(2);
    expect(conteo.cantidadHoras.p50).toBe(1);
    expect(conteo.cantidadHoras.p75).toBe(1);
  });

  it('Exactamente 3h de extra (17:00-20:00) no activa p75', async () => {
    const fecha = '2025-09-20'; // Sábado para aislar
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T07:00:00-06:00`), // sin jornada
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra exacta 3h', esExtra: true, duracionHoras: 3,
          horaInicio: new Date(`${fecha}T17:00:00-06:00`), horaFin: new Date(`${fecha}T20:00:00-06:00`) },
      ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.p25).toBe(2);
    expect(c.cantidadHoras.p50).toBe(1);
    expect(c.cantidadHoras.p75).toBe(0);
  });

  it('3h 15min de extra (17:00-20:15) activa 0.25h p75', async () => {
    const fecha = '2025-09-21'; // Domingo para aislar, pero C4 podría interferir; usamos sábado siguiente
    const fechaUse = '2025-09-27'; // Sábado
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha: fechaUse,
      horaEntrada: new Date(`${fechaUse}T07:00:00-06:00`),
      horaSalida: new Date(`${fechaUse}T07:00:00-06:00`),
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra 3h15', esExtra: true, duracionHoras: 3,
          horaInicio: new Date(`${fechaUse}T17:00:00-06:00`), horaFin: new Date(`${fechaUse}T20:15:00-06:00`) },
      ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fechaUse, fechaUse, String(empleadoId));
    expect(c.cantidadHoras.p25).toBe(2);
    expect(c.cantidadHoras.p50).toBe(1);
    expect(c.cantidadHoras.p75).toBe(0.25);
  });

  it('Domingo 10:00-12:00 cuenta como p100', async () => {
    const fecha = '2025-09-14'; // Domingo
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T07:00:00-06:00`),
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra dom', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${fecha}T10:00:00-06:00`), horaFin: new Date(`${fecha}T12:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.p100).toBe(2);
    expect(conteo.cantidadHoras.normal).toBe(0);
  });

  it('Vacaciones: NORMAL clasifica en vacaciones', async () => {
    const fecha = '2025-09-10'; // Miércoles
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId: jobVacId, descripcion: 'Vacaciones', duracionHoras: 8, esExtra: false,
          horaInicio: new Date(`${fecha}T07:00:00-06:00`), horaFin: new Date(`${fecha}T17:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.vacaciones).toBe(9);
    expect(conteo.cantidadHoras.normal).toBe(0);
    expect(conteo.cantidadHoras.almuerzo).toBe(1);
  });

  it('Sábado sin jornada: extra 10:00-12:00 cuenta como 2h p25', async () => {
    const fecha = '2025-09-13'; // Sábado
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T07:00:00-06:00`), // sin jornada
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra sábado', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${fecha}T10:00:00-06:00`), horaFin: new Date(`${fecha}T12:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.normal).toBe(0);
    expect(conteo.cantidadHoras.p25).toBe(2);
    expect(conteo.cantidadHoras.p50).toBe(0);
  });

  it('Reset de racha por LIBRE entre extras: 17:00-18:00 (p25) y 20:00-21:00 (p50) separado por LIBRE', async () => {
    const fecha = '2025-09-11'; // Jueves
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Extra 17-18', esExtra: true, duracionHoras: 1,
          horaInicio: new Date(`${fecha}T17:00:00-06:00`), horaFin: new Date(`${fecha}T18:00:00-06:00`) },
        { jobId, descripcion: 'Extra 20-21', esExtra: true, duracionHoras: 1,
          horaInicio: new Date(`${fecha}T20:00:00-06:00`), horaFin: new Date(`${fecha}T21:00:00-06:00`) },
        { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 8 },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.p25).toBe(1);
    expect(conteo.cantidadHoras.p50).toBe(1);
    expect(conteo.cantidadHoras.p75).toBe(0);
  });

  it('Racha cruza medianoche sin LIBRE: 17:00-24:00 y 00:00-02:00; las 00:00-02:00 cuentan p75', async () => {
    const fecha = '2025-09-12'; // Viernes
    const dia2 = '2025-09-13'; // Sábado
    // Día 1: extras continuas 17-24 (2h diurna + 5h nocturna)
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T16:00:00-06:00`), // viernes
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 7 },
        { jobId, descripcion: 'Extra 17-24', esExtra: true, duracionHoras: 7,
          horaInicio: new Date(`${fecha}T17:00:00-06:00`), horaFin: new Date(`${fecha}T24:00:00-06:00`) },
      ],
    });

    // Día 2: arranca con extra 00:00-02:00 (no hay LIBRE intermedio)
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha: dia2,
      horaEntrada: new Date(`${dia2}T07:00:00-06:00`),
      horaSalida: new Date(`${dia2}T07:00:00-06:00`), // sábado sin jornada
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra 00-02', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${dia2}T00:00:00-06:00`), horaFin: new Date(`${dia2}T02:00:00-06:00`) },
      ],
    });

    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(dia2, dia2, String(empleadoId));
    expect(conteo.cantidadHoras.p75).toBe(2);
    expect(conteo.cantidadHoras.p25).toBe(0);
  });

  it('Feriado: extra diurna 10:00-12:00 cuenta como p100', async () => {
    const fecha = '2025-09-15'; // lunes
    await ensureFeriado(fecha, 'Día Patria');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T07:00:00-06:00`), // sin jornada
      esDiaLibre: true,
      esHoraCorrida: true,
      actividades: [
        { jobId, descripcion: 'Extra feriado', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${fecha}T10:00:00-06:00`), horaFin: new Date(`${fecha}T12:00:00-06:00`) },
      ],
    });
    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.p100).toBe(2);
    expect(conteo.cantidadHoras.p25).toBe(0);
  });

  it('Feriado: jornada 07:00-17:00 sigue normal (9h normal + 1h almuerzo)', async () => {
    const fecha = '2025-09-16'; // martes
    await ensureFeriado(fecha, 'Feriado Test');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 9 } ],
    });
    const conteo = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(conteo.cantidadHoras.normal).toBe(9);
    expect(conteo.cantidadHoras.almuerzo).toBe(1);
    expect(conteo.cantidadHoras.p100).toBe(0);
  });

  it('E01 Incapacidad: clasifica en incapacidad', async () => {
    const fecha = '2025-09-17';
    const e01 = await ensureJobByCode('E01', 'Incapacidad');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId: e01, descripcion: 'Incapacidad', esExtra: false, duracionHoras: 9,
        horaInicio: new Date(`${fecha}T07:00:00-06:00`), horaFin: new Date(`${fecha}T17:00:00-06:00`) } ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.incapacidad).toBe(9);
    expect(c.cantidadHoras.almuerzo).toBe(1);
    expect(c.cantidadHoras.normal).toBe(0);
  });

  it('E03 Permiso con sueldo: clasifica en permisoConSueldo', async () => {
    const fecha = '2025-09-18';
    const e03 = await ensureJobByCode('E03', 'Permiso con goce');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId: e03, descripcion: 'Permiso con goce', esExtra: false, duracionHoras: 9,
        horaInicio: new Date(`${fecha}T07:00:00-06:00`), horaFin: new Date(`${fecha}T17:00:00-06:00`) } ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.permisoConSueldo).toBe(9);
    expect(c.cantidadHoras.normal).toBe(0);
  });

  it('E04 Permiso sin sueldo: clasifica en permisoSinSueldo', async () => {
    const fecha = '2025-09-19';
    const e04 = await ensureJobByCode('E04', 'Permiso sin goce');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId: e04, descripcion: 'Permiso sin goce', esExtra: false, duracionHoras: 9,
        horaInicio: new Date(`${fecha}T07:00:00-06:00`), horaFin: new Date(`${fecha}T17:00:00-06:00`) } ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.permisoSinSueldo).toBe(9);
    expect(c.cantidadHoras.normal).toBe(0);
  });

  it('E05 Compensatorio: clasifica en compensatorio', async () => {
    const fecha = '2025-09-22';
    const e05 = await ensureJobByCode('E05', 'Compensatorio');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [ { jobId: e05, descripcion: 'Compensatorio', esExtra: false, duracionHoras: 9,
        horaInicio: new Date(`${fecha}T07:00:00-06:00`), horaFin: new Date(`${fecha}T17:00:00-06:00`) } ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.compensatorio).toBe(9);
    expect(c.cantidadHoras.normal).toBe(0);
  });

  it('Almuerzo no aplica si esHoraCorrida=true (07:00-17:00)', async () => {
    const fecha = '2025-09-23';
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha,
      horaEntrada: new Date(`${fecha}T07:00:00-06:00`),
      horaSalida: new Date(`${fecha}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: true,
      actividades: [ { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 10 } ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(fecha, fecha, String(empleadoId));
    expect(c.cantidadHoras.almuerzo).toBe(0);
    expect(c.cantidadHoras.normal).toBe(10);
  });

  it('C4 (festiva nocturna) arrastra piso: 22:00-24:00 p100 y 00:00-02:00 al siguiente día p50', async () => {
    const f1 = '2025-09-24'; // miércoles
    const f2 = '2025-09-25'; // jueves
    await ensureFeriado(f1, 'Feriado Noct');
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha: f1,
      horaEntrada: new Date(`${f1}T07:00:00-06:00`),
      horaSalida: new Date(`${f1}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 9 },
        { jobId, descripcion: 'Extra festiva noct', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${f1}T22:00:00-06:00`), horaFin: new Date(`${f1}T24:00:00-06:00`) },
      ],
    });
    await RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      fecha: f2,
      horaEntrada: new Date(`${f2}T07:00:00-06:00`),
      horaSalida: new Date(`${f2}T17:00:00-06:00`),
      esDiaLibre: false,
      esHoraCorrida: false,
      actividades: [
        { jobId, descripcion: 'Normal', esExtra: false, duracionHoras: 9 },
        { jobId, descripcion: 'Extra post festivo 00-02', esExtra: true, duracionHoras: 2,
          horaInicio: new Date(`${f2}T00:00:00-06:00`), horaFin: new Date(`${f2}T02:00:00-06:00`) },
      ],
    });
    const c = await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(f2, f2, String(empleadoId));
    expect(c.cantidadHoras.p50).toBe(2);
    expect(c.cantidadHoras.p25).toBe(0);
    expect(c.cantidadHoras.p75).toBe(0);
  });
});
