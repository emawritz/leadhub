export const SCORE_WEIGHTS = {
  telefono: 20,
  whatsapp: 15,
  email: 15,
  web: 15,
  redes: 10,
  cuit: 10,
  fuenteGoogle: 15,
} as const;

type ScorableLead = {
  telefono?: string; whatsapp?: string; email?: string; sitioWeb?: string;
  instagram?: string; facebook?: string; cuit?: string; fuente?: string;
};

const present = (v: string | undefined): boolean => (v ?? '') !== '';

/** Score de prioridad 0–100 desde señales objetivas del lead. */
export function scoreLead(lead: ScorableLead): number {
  let s = 0;
  if (present(lead.telefono)) s += SCORE_WEIGHTS.telefono;
  if (present(lead.whatsapp)) s += SCORE_WEIGHTS.whatsapp;
  if (present(lead.email)) s += SCORE_WEIGHTS.email;
  if (present(lead.sitioWeb)) s += SCORE_WEIGHTS.web;
  if (present(lead.instagram) || present(lead.facebook)) s += SCORE_WEIGHTS.redes;
  if (present(lead.cuit)) s += SCORE_WEIGHTS.cuit;
  if (lead.fuente === 'Google Maps') s += SCORE_WEIGHTS.fuenteGoogle;
  return s;
}

export type ScoreTier = 'alto' | 'medio' | 'bajo';
export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return 'alto';
  if (score >= 40) return 'medio';
  return 'bajo';
}
