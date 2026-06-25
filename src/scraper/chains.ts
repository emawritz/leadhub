// Cadenas conocidas que NO son prospectos (excluibles con --exclude-chains).
// Editar esta lista para ajustar el filtro. Match por palabra completa sobre
// el nombre normalizado (minúsculas, sin acentos).
export const KNOWN_CHAINS = [
  // Supermercados / hipermercados
  'coto', 'carrefour', 'dia', 'jumbo', 'disco', 'vea', 'la anonima',
  'walmart', 'changomas', 'chango mas', 'libertad',
  // Mayoristas
  'vital', 'maxiconsumo', 'diarco', 'yaguar', 'makro',
];

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isKnownChain(name: string): boolean {
  const n = norm(name);
  return KNOWN_CHAINS.some((chain) => new RegExp(`\\b${escape(chain)}\\b`).test(n));
}
