// src/validators/planillaAccesoRevision.validator.ts
import { z } from "zod";

export const createPlanillaAccesoRevisionSchema = z.object({
  supervisorId: z
    .number()
    .int()
    .positive("El supervisorId es requerido y debe ser un número positivo"),
  empleadoId: z
    .number()
    .int()
    .positive("El empleadoId es requerido y debe ser un número positivo"),
});

export type CreatePlanillaAccesoRevisionDto = z.infer<
  typeof createPlanillaAccesoRevisionSchema
>;

// Para update: todos opcionales (pero si envías relaciones deben ser válidas)
export const updatePlanillaAccesoRevisionSchema =
  createPlanillaAccesoRevisionSchema.partial();
export type UpdatePlanillaAccesoRevisionDto = z.infer<
  typeof updatePlanillaAccesoRevisionSchema
>;



