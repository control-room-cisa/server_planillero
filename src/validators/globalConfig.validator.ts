import { z } from "zod";

export const globalConfigUpsertSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(255),
  description: z.string().trim().max(255).optional().nullable(),
});

export type UpsertGlobalConfigDto = z.infer<typeof globalConfigUpsertSchema>;

