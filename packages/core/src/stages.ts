export const STAGES = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'interesado', label: 'Interesado' },
  { id: 'negociacion', label: 'Negociación' },
  { id: 'ganado', label: 'Ganado' },
  { id: 'perdido', label: 'Perdido' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];
export const CLOSED_STAGES: StageId[] = ['ganado', 'perdido'];
export function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

export const ACTIVITY_TYPES = ['nota', 'llamada', 'email', 'whatsapp', 'etapa'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const USER_ACTIVITY_TYPES = ['nota', 'llamada', 'email', 'whatsapp'] as const;
