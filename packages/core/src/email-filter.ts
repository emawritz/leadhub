const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const EMAIL_BLOCKLIST = [
  'sentry', 'wix', 'wordpress', 'example', 'ejemplo', 'noreply', 'privacy',
  'support@google', 'tucorreo', 'youremail', 'email@',
];

// Falsos positivos: nombres de archivos de assets capturados por el regex
// (ej. "logo@2x.png", "icon@2x.svg" se parsean como email@dominio.ext).
const ASSET_EXT_RE = /\.(png|jpe?g|gif|svg|webp|bmp|ico|css|js|woff2?|ttf|eot|mp4|pdf)$/i;

export function extractEmails(html: string): string[] {
  return html.match(EMAIL_RE) ?? [];
}

export function filterEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    if (ASSET_EXT_RE.test(email)) continue;
    if (EMAIL_BLOCKLIST.some((b) => email.includes(b))) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
