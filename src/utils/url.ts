export function normalizeUrl(u: string): string {
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
