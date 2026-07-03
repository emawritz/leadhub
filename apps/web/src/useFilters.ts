import { useSearchParams } from 'react-router-dom';

export type UiFilters = {
  q?: string; provincia?: string[]; localidad?: string[]; categoria?: string[]; fuente?: string[];
  hasEmail?: boolean; hasTelefono?: boolean; hasWhatsapp?: boolean; hasWeb?: boolean; hasCuit?: boolean;
  soloAlto?: boolean;
  page?: number; sort?: string;
};
const ARRAYS = ['provincia', 'localidad', 'categoria', 'fuente'] as const;
const BOOLS = ['hasEmail', 'hasTelefono', 'hasWhatsapp', 'hasWeb', 'hasCuit', 'soloAlto'] as const;

export function filtersToQuery(f: UiFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const k of ARRAYS) (f[k] ?? []).forEach((v) => p.append(k, v));
  for (const k of BOOLS) if (f[k]) p.set(k, 'true');
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.sort) p.set('sort', f.sort);
  return p.toString();
}
export function queryToFilters(p: URLSearchParams): UiFilters {
  const f: UiFilters = {};
  if (p.get('q')) f.q = p.get('q')!;
  for (const k of ARRAYS) { const vs = p.getAll(k); if (vs.length) f[k] = vs; }
  for (const k of BOOLS) if (p.get(k) === 'true') f[k] = true;
  if (p.get('page')) f.page = Number(p.get('page'));
  if (p.get('sort')) f.sort = p.get('sort')!;
  return f;
}
export function useFilters(): [UiFilters, (f: UiFilters) => void] {
  const [params, setParams] = useSearchParams();
  return [queryToFilters(params), (f) => setParams(filtersToQuery(f))];
}
