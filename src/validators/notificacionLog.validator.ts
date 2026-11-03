import { z } from "zod";

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const listNotificacionesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    soloNoLeidas: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        return value === true || value === "true";
      }),
    categoria: z.string().max(50).optional(),
  }),
});

export const notificacionIdParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
});
