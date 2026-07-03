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

export const STAGE_COLORS: Record<StageId, string> = {
  nuevo: '#8e8e93',
  contactado: '#0071a8',
  interesado: '#6e5aa8',
  negociacion: '#b06d1f',
  ganado: '#1a7f52',
  perdido: '#b23b3b',
};

/** Hex de la etapa; gris neutro si el id no matchea. */
export function stageColor(id: string): string {
  return (STAGE_COLORS as Record<string, string>)[id] ?? '#8e8e93';
}

/** Ícono + color por tipo de actividad, para el timeline del drawer. */
export const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  nota: { icon: '📝', color: '#64748b' },
  llamada: { icon: '📞', color: '#3b82f6' },
  email: { icon: '✉️', color: '#8b5cf6' },
  whatsapp: { icon: '💬', color: '#10b981' },
  etapa: { icon: '🔀', color: '#f59e0b' },
};
