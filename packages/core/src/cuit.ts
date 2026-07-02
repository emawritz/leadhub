// Validación y extracción de CUIT/CUIL argentino (11 dígitos, formato XX-XXXXXXXX-X).
// La validación por dígito verificador (mod-11) evita falsos positivos (teléfonos, etc.).

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const VALID_PREFIXES = ['20', '23', '24', '25', '26', '27', '30', '33', '34'];

export function isValidCuit(input: string): boolean {
  const d = input.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (!VALID_PREFIXES.includes(d.slice(0, 2))) return false;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  const mod = sum % 11;
  let check = 11 - mod;
  if (check === 11) check = 0;
  if (check === 10) return false; // CUIT inválido por convención
  return check === Number(d[10]);
}

export function formatCuit(input: string): string {
  const d = input.replace(/\D/g, '');
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

// Candidatos: con guiones (XX-XXXXXXXX-X) o 11 dígitos seguidos.
const CUIT_RE = /\b(\d{2}-?\d{8}-?\d)\b/g;

export function extractCuit(html: string): string {
  const matches = html.match(CUIT_RE) ?? [];
  for (const m of matches) {
    if (isValidCuit(m)) return formatCuit(m);
  }
  return '';
}
