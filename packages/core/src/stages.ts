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

/** Color de acento (hex) por etapa — token único, consumido con style inline en la UI. */
export const STAGE_COLORS: Record<StageId, string> = {
  nuevo: '#64748b',       // slate-500
  contactado: '#3b82f6',  // blue-500
  interesado: '#8b5cf6',  // violet-500
  negociacion: '#f59e0b', // amber-500
  ganado: '#10b981',      // emerald-500
  perdido: '#ef4444',     // red-500
};

/** Hex de la etapa; gris neutro si el id no matchea. */
export function stageColor(id: string): string {
  return (STAGE_COLORS as Record<string, string>)[id] ?? '#64748b';
}

/** Ícono + color por tipo de actividad, para el timeline del drawer. */
export const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  nota: { icon: '📝', color: '#64748b' },
  llamada: { icon: '📞', color: '#3b82f6' },
  email: { icon: '✉️', color: '#8b5cf6' },
  whatsapp: { icon: '💬', color: '#10b981' },
  etapa: { icon: '🔀', color: '#f59e0b' },
};
