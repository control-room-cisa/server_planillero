import { z } from "zod";

export const createAccesoContabilidadSchema = z.object({
  empleadoId: z
    .number()
    .int()
    .positive("El id del empleado es requerido"),
  empresaId: z
    .number()
    .int()
    .positive("El id de la empresa es requerido"),
});

export type CreateAccesoContabilidadDto = z.infer<
  typeof createAccesoContabilidadSchema
>;

export const updateAccesoContabilidadSchema = createAccesoContabilidadSchema;
export type UpdateAccesoContabilidadDto = z.infer<
  typeof updateAccesoContabilidadSchema
>;
