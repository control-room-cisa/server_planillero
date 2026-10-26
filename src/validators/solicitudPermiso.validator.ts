import { z } from "zod";

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de fecha debe ser YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }, "Fecha inválida");

const comentarioHorarioSchema = z
  .string()
  .max(200, "El horario no puede tener más de 200 caracteres")
  .optional()
  .nullable();

const diaSchema = z.object({
  fecha: fechaSchema,
  comentarioHorario: comentarioHorarioSchema,
});

const diasSchema = z
  .array(diaSchema)
  .min(1, "Agrega al menos un día")
  .max(60, "Máximo 60 días por solicitud")
  .superRefine((dias, ctx) => {
    const seen = new Set<string>();
    dias.forEach((dia, index) => {
      if (seen.has(dia.fecha)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha está repetida",
          path: [index, "fecha"],
        });
      }
      seen.add(dia.fecha);
    });
  });

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const createSolicitudPermisoSchema = z.object({
  body: z.object({
    tipo: z.enum(["VACACIONES", "PERMISO"], {
      required_error: "El tipo es requerido",
      invalid_type_error: "El tipo debe ser VACACIONES o PERMISO",
    }),
    comentario: z
      .string()
      .max(500, "El comentario no puede tener más de 500 caracteres")
      .optional()
      .nullable(),
    dias: diasSchema,
  }),
});

export const updateSolicitudPermisoSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
  body: z.object({
    tipo: z.enum(["VACACIONES", "PERMISO"], {
      required_error: "El tipo es requerido",
      invalid_type_error: "El tipo debe ser VACACIONES o PERMISO",
    }),
    comentario: z
      .string()
      .max(500, "El comentario no puede tener más de 500 caracteres")
      .optional()
      .nullable(),
    dias: diasSchema,
  }),
});

export const solicitudIdParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
});

export const listPropiasSchema = z.object({
  query: z.object(paginationQuery),
});

export const listSupervisionSchema = z.object({
  query: z.object(paginationQuery),
});

export const listRrhhSchema = z.object({
  query: z.object({
    ...paginationQuery,
    empresaId: z.coerce
      .number({ invalid_type_error: "La empresa es requerida" })
      .int("La empresa debe ser un número entero")
      .positive("La empresa debe ser positiva"),
  }),
});

export const listDiasSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
  query: z.object(paginationQuery),
});

export const calendarioSchema = z.object({
  query: z
    .object({
      desde: fechaSchema,
      hasta: fechaSchema,
    })
    .refine((value) => value.desde <= value.hasta, {
      message: "La fecha desde no puede ser posterior a hasta",
      path: ["desde"],
    })
    .refine(
      (value) => {
        const [y1, m1, d1] = value.desde.split("-").map(Number);
        const [y2, m2, d2] = value.hasta.split("-").map(Number);
        const start = Date.UTC(y1, m1 - 1, d1);
        const end = Date.UTC(y2, m2 - 1, d2);
        return (end - start) / 86_400_000 <= 62;
      },
      {
        message: "El rango no puede superar 62 días",
        path: ["hasta"],
      }
    ),
});

export const calendarioDiaSchema = z.object({
  query: z.object({
    ...paginationQuery,
    fecha: fechaSchema,
  }),
});

export const decisionSolicitudSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID inválido"),
  }),
  body: z
    .object({
      aprobado: z.boolean({
        required_error: "Indica si se aprueba o se rechaza",
        invalid_type_error: "El campo aprobado debe ser verdadero o falso",
      }),
      comentario: z
        .string()
        .max(500, "El comentario no puede tener más de 500 caracteres")
        .optional()
        .nullable(),
    })
    .superRefine((value, ctx) => {
      if (!value.aprobado && !value.comentario?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El comentario es obligatorio al rechazar",
          path: ["comentario"],
        });
      }
    }),
});

export type CreateSolicitudPermisoBody = z.infer<
  typeof createSolicitudPermisoSchema
>["body"];
export type UpdateSolicitudPermisoBody = z.infer<
  typeof updateSolicitudPermisoSchema
>["body"];
export type DecisionSolicitudBody = z.infer<
  typeof decisionSolicitudSchema
>["body"];
