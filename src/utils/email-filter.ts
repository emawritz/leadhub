const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const EMAIL_BLOCKLIST = [
  'sentry', 'wix', 'wordpress', 'example', 'noreply', 'privacy', 'support@google',
];

export function extractEmails(html: string): string[] {
  return html.match(EMAIL_RE) ?? [];
}

export function filterEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    if (EMAIL_BLOCKLIST.some((b) => email.includes(b))) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
