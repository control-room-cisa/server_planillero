import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const empleados = await p.empleado.count();
  const filasPuente = await p.empleadoRol.count();
  const conRoles = await p.empleadoRol.groupBy({
    by: ["empleadoId"],
  });
  const sinEmpleado = await p.$queryRaw<
    Array<{ c: bigint }>
  >`SELECT COUNT(*) AS c FROM empleados e
    WHERE NOT EXISTS (
      SELECT 1 FROM empleado_roles er
      WHERE er.empleado_id = e.id AND er.rol_id = 1
    )`;
  const soloUnRol = await p.$queryRaw<
    Array<{ c: bigint }>
  >`SELECT COUNT(*) AS c FROM (
      SELECT empleado_id FROM empleado_roles
      GROUP BY empleado_id HAVING COUNT(*) = 1
    ) t`;
  const multiRol = await p.$queryRaw<
    Array<{ c: bigint }>
  >`SELECT COUNT(*) AS c FROM (
      SELECT empleado_id FROM empleado_roles
      GROUP BY empleado_id HAVING COUNT(*) > 1
    ) t`;

  const sampleSup = await p.empleadoRol.findFirst({
    where: { rolId: 2 },
    select: { empleadoId: true },
  });
  const sampleRrhh = await p.empleadoRol.findFirst({
    where: { rolId: 3 },
    select: { empleadoId: true },
  });
  const sampleEmp = await p.empleadoRol.findFirst({
    where: {
      rolId: 1,
      empleado: {
        roles: { none: { rolId: { not: 1 } } },
      },
    },
    select: { empleadoId: true },
  });

  const rolesOf = (id: number) =>
    p.empleadoRol.findMany({
      where: { empleadoId: id },
      select: { rolId: true },
      orderBy: { rolId: "asc" },
    });

  console.log({
    empleados,
    filasPuente,
    empleadosConAlMenosUnRol: conRoles.length,
    sinRolEmpleado: Number(sinEmpleado[0]?.c ?? 0),
    soloUnRol: Number(soloUnRol[0]?.c ?? 0),
    multiRol: Number(multiRol[0]?.c ?? 0),
    sampleSupervisorRoles: sampleSup
      ? await rolesOf(sampleSup.empleadoId)
      : null,
    sampleRrhhRoles: sampleRrhh ? await rolesOf(sampleRrhh.empleadoId) : null,
    sampleSoloEmpleadoRoles: sampleEmp
      ? await rolesOf(sampleEmp.empleadoId)
      : null,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
