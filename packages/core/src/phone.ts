// Teléfono argentino: opcional +54 / 0, código de área, y 6-8 dígitos con separador.
// Requiere al menos un separador (espacio/punto/guion) o el prefijo +54 para
// evitar falsos positivos con números sueltos (años, cantidades).
const TEL_HREF_RE = /href=["']tel:([^"']+)["']/i;
const PHONE_TEXT_RE = /(\+?54[\s.-]?)?(?:0?\d{2,4}[\s.-]+)\d{3,4}[\s.-]?\d{4}/;

export function extractPhone(html: string): string {
  const href = html.match(TEL_HREF_RE);
  if (href) return href[1].trim();
  const text = html.replace(/<[^>]+>/g, ' ');
  const m = text.match(PHONE_TEXT_RE);
  return m ? m[0].trim() : '';
}
