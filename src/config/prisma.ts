import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error"], //ver consultas en consola
});

// Middleware para “soft-delete”: excluir always deletedAt != null
prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
  const now = new Date();

  // Sólo para acciones de lectura sobre modelos que tienen deletedAt
  const readActions = ["findUnique", "findFirst", "findMany", "count"];
  if (
    readActions.includes(params.action) &&
    params.model &&
    // ajusta esta lista a tus modelos “soft-delete”
    ["Empresa", "Job", "Empleado", "Departamento" /*…*/].includes(params.model)
  ) {
    // Inyecta deletedAt: null en el where
    if (!params.args) {
      params.args = { where: { deletedAt: null } };
    } else if (params.args.where) {
      // si ya había filtros, los preservamos
      params.args.where = {
        AND: [params.args.where, { deletedAt: null }],
      };
    } else {
      params.args.where = { deletedAt: null };
    }
  }

  // 2) Para operaciones de creación, fijar createdAt si no viene
  const writeCreateActions = ["create", "createMany"];
  if (writeCreateActions.includes(params.action) && params.model) {
    if (params.action === "create") {
      // params.args.data es un objeto único
      if (!("createdAt" in (params.args.data as any))) {
        (params.args.data as any).createdAt = now;
      }
    }
    if (params.action === "createMany") {
      // params.args.data es un array de objetos
      const datas = (params.args.data as any[]).map((d) => ({
        createdAt: now,
        ...d,
      }));
      params.args.data = datas;
    }
  }

  return next(params);
});
