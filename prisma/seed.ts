// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Seed Roles
  const roles = [
    { id: 1, nombre: "Empleado" },
    { id: 2, nombre: "Supervisor" },
    { id: 3, nombre: "Recursos Humanos" },
    { id: 4, nombre: "Contabilidad" },
  ] as const;

  for (const { id, nombre } of roles) {
    await prisma.rol.upsert({
      where: { id },
      update: {},
      create: { id, nombre },
    });
  }

  // 2) Seed Empresas y Departamentos
  const empresasConDept = {
    CopEnergy: ["ControlRoom"],
    Arrayan: ["It", "Electricidad", "Construccion"],
    IDSA: ["IDSA"],
    Linx: ["Linx"],
    Fincasa: ["Agricultura"],
    Durrikikara: ["Cocina", "Turismo"],
  } as const;

  for (const [empresaNombre, depts] of Object.entries(empresasConDept)) {
    // crea o recupera la empresa
    let empresa = await prisma.empresa.findFirst({
      where: { nombre: empresaNombre },
    });
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: { nombre: empresaNombre },
      });
    }

    // crea cada departamento
    for (const deptNombre of depts) {
      await prisma.departamento
        .upsert({
          where: {
            // combinación empresaId + nombre no es un índice único por defecto,
            // usamos findFirst+create si no existe:
            id: -1, // dummy, funcionaremos con catch
          },
          update: {},
          create: {
            nombre: deptNombre,
            codigo: deptNombre.substring(0, 10).toUpperCase(),
            empresaId: empresa.id,
          },
        })
        .catch(async () => {
          const exists = await prisma.departamento.findFirst({
            where: { nombre: deptNombre, empresaId: empresa.id },
          });
          if (!exists) {
            await prisma.departamento.create({
              data: {
                nombre: deptNombre,
                codigo: deptNombre.substring(0, 10).toUpperCase(),
                empresaId: empresa.id,
              },
            });
          }
        });
    }
  }

  // 3) Seed Jobs
  const jobsToSeed = [
    // Jobs normales (con empresa)
    {
      empresa: "CopEnergy",
      nombre: "Operator",
      codigo: "OPR",
      descripcion: "Operador de sala",
    },
    {
      empresa: "CopEnergy",
      nombre: "Technician",
      codigo: "TECH",
      descripcion: "Técnico de control",
    },
    {
      empresa: "Arrayan",
      nombre: "Developer",
      codigo: "DEV",
      descripcion: "Desarrollador software",
    },
    {
      empresa: "Arrayan",
      nombre: "Electrician",
      codigo: "ELEC",
      descripcion: "Técnico electricista",
    },
    {
      empresa: "Arrayan",
      nombre: "Constructor",
      codigo: "CONS",
      descripcion: "Obrero de construcción",
    },
    {
      empresa: "IDSA",
      nombre: "Analyst",
      codigo: "ANL",
      descripcion: "Analista de datos",
    },
    {
      empresa: "Linx",
      nombre: "Consultant",
      codigo: "CONS",
      descripcion: "Consultor de sistemas",
    },
    {
      empresa: "Fincasa",
      nombre: "Agronomist",
      codigo: "AGRO",
      descripcion: "Ingeniero agrónomo",
    },
    {
      empresa: "Durrikikara",
      nombre: "Chef",
      codigo: "CHEF",
      descripcion: "Chef profesional",
    },
    {
      empresa: "Durrikikara",
      nombre: "TourGuide",
      codigo: "TOUR",
      descripcion: "Guía turístico",
    },
  ] as const;

  // Jobs especiales (sin empresa)
  const jobsEspecialesToSeed = [
    {
      codigo: "E01",
      nombre: "Incapacidad",
      descripcion: "Ausencia por incapacidad médica",
    },
    {
      codigo: "E02",
      nombre: "Vacaciones",
      descripcion: "Período de vacaciones",
    },
    {
      codigo: "E03",
      nombre: "Permiso con goce",
      descripcion: "Permiso con goce de sueldo",
    },
    {
      codigo: "E04",
      nombre: "Permiso sin goce",
      descripcion: "Permiso sin goce de sueldo",
    },
  ] as const;

  for (const jobDef of jobsToSeed) {
    // busca la empresa por nombre
    const empresa = await prisma.empresa.findFirst({
      where: { nombre: jobDef.empresa },
    });
    if (!empresa) continue;

    await prisma.job
      .upsert({
        where: {
          // al no haber un unique compuesto, usamos catch similar a arriba
          id: -1,
        },
        update: {},
        create: {
          nombre: jobDef.nombre,
          codigo: jobDef.codigo,
          descripcion: jobDef.descripcion,
          empresaId: empresa.id,
          mostrarEmpresaId: empresa.id,
          activo: true,
        },
      })
      .catch(async () => {
        const exists = await prisma.job.findFirst({
          where: {
            nombre: jobDef.nombre,
            empresaId: empresa.id,
          },
        });
        if (!exists) {
          await prisma.job.create({
            data: {
              nombre: jobDef.nombre,
              codigo: jobDef.codigo,
              descripcion: jobDef.descripcion,
              empresaId: empresa.id,
              mostrarEmpresaId: empresa.id,
              activo: true,
            },
          });
        }
      });
  }

  // Crear jobs especiales
  for (const jobDef of jobsEspecialesToSeed) {
    await prisma.job
      .upsert({
        where: {
          id: -1,
        },
        update: {},
        create: {
          nombre: jobDef.nombre,
          codigo: jobDef.codigo,
          descripcion: jobDef.descripcion,
          especial: true,
          activo: true,
        },
      })
      .catch(async () => {
        const exists = await prisma.job.findFirst({
          where: {
            codigo: jobDef.codigo,
            especial: true,
          },
        });
        if (!exists) {
          await prisma.job.create({
            data: {
              nombre: jobDef.nombre,
              codigo: jobDef.codigo,
              descripcion: jobDef.descripcion,
              especial: true,
              activo: true,
            },
          });
        }
      });
  }

  console.log("✔️ Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
