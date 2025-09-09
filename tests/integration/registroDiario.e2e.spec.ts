import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, describe, it, expect } from 'vitest';
const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
import { buildTestApp } from '../helpers/app';
import { PrismaClient, TipoHorario } from '@prisma/client';

const prisma = new PrismaClient();

async function prepareUserToken() {
  // Ensure base refs
  let empresa = await prisma.empresa.findFirst({ where: { deletedAt: null } });
  if (!empresa) empresa = await prisma.empresa.create({ data: { nombre: 'E2E Co' } });
  let dept = await prisma.departamento.findFirst({ where: { empresaId: empresa.id, deletedAt: null } });
  if (!dept) {
    dept = await prisma.departamento.create({ data: { empresaId: empresa.id, nombre: 'E2E Dept', codigo: 'E2E' } });
  }
  let rol = await prisma.rol.findFirst({ where: { nombre: 'Empleado' } });
  if (!rol) rol = await prisma.rol.create({ data: { id: 1002, nombre: 'Empleado' } });

  const now = Date.now();
  const empleado = await prisma.empleado.create({
    data: {
      nombre: 'E2E',
      apellido: 'User',
      nombreUsuario: `e2e${now}`.slice(0, 15),
      codigo: `E2E${now}`.slice(0, 20),
      correoElectronico: `e2e${now}@test.local`,
      departamentoId: dept.id,
      rolId: rol.id,
      tipoHorario: TipoHorario.H2,
      activo: true,
    },
    select: { id: true },
  });

  const secret = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign({ id: empleado.id, correo: `e2e${now}@test.local` }, secret, { expiresIn: '1h' });
  return { empleadoId: empleado.id, token, empresaId: empresa.id };
}

describeDb('E2E: /api/registrodiario', () => {
  let token: string;
  let empleadoId: number;
  const app = buildTestApp();

  beforeAll(async () => {
    const u = await prepareUserToken();
    token = u.token;
    empleadoId = u.empleadoId;
  });

  it('POST crea registro 07:00-19:00', async () => {
    const fecha = '2025-09-06';
    const res = await request(app)
      .post('/api/registrodiario')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fecha,
        horaEntrada: new Date(`${fecha}T07:00:00`),
        horaSalida: new Date(`${fecha}T19:00:00`),
        esDiaLibre: false,
        esHoraCorrida: false,
        actividades: [],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();

    const saved = await prisma.registroDiario.findFirst({ where: { empleadoId, fecha } });
    expect(saved).toBeTruthy();
  });
});
