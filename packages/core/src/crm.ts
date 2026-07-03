import { z } from 'zod';
import { STAGE_IDS, USER_ACTIVITY_TYPES } from './stages.js';

export const pipelineCreateSchema = z.object({
  leadId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
});
export const pipelineUpdateSchema = z.object({
  stage: z.enum(STAGE_IDS).optional(),
  ownerId: z.string().uuid().nullable().optional(),
});
export const activityCreateSchema = z.object({
  tipo: z.enum(USER_ACTIVITY_TYPES),
  cuerpo: z.string().trim().min(1),
});
export const taskCreateSchema = z.object({
  titulo: z.string().trim().min(1),
  vence: z.string().datetime().optional(),
});
export const taskUpdateSchema = z.object({ hecha: z.boolean() });

export type PipelineCreate = z.infer<typeof pipelineCreateSchema>;
export type PipelineUpdate = z.infer<typeof pipelineUpdateSchema>;
export type ActivityCreate = z.infer<typeof activityCreateSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
