import { extractEmails, filterEmails } from './email-filter.js';
import { normalizeUrl } from './url.js';
import { extractPhone } from './phone.js';
import type { Lead } from './types.js';

export interface SocialProfileData {
  email?: string;
  telefono?: string;
  sitioWeb?: string;
  whatsapp?: string;
  direccion?: string;
}

// Marcadores robustos a acento: se busca el fragmento sin el prefijo
// "inicia/iniciá" para matchear ambas variantes ("Iniciá sesión", "Inicia sesión").
// Marcadores en el cuerpo del HTML. 'checkpoint' NO va acá (es palabra común y
// daría falsos positivos); el redirect real de checkpoint se detecta por URL en
// la capa I/O (social-enricher.ts, LOGIN_URL_RE).
const LOGIN_MARKERS = [
  '/login/device-based/',
  'accounts/login',
  'log in to facebook',
  'sesión en facebook',
  'sesión para ver',
];

export function isSocialLoginWall(html: string): boolean {
  const low = html.toLowerCase();
  return LOGIN_MARKERS.some((m) => low.includes(m));
}

const WA_RE = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{6,})/i;

export function extractWhatsappLink(html: string): string {
  const m = html.match(WA_RE);
  return m ? `https://wa.me/${m[1].replace(/\D/g, '')}` : '';
}

// FB envuelve los links salientes en l.facebook.com/l.php?u=<encoded>.
const FB_OUT_RE = /l\.facebook\.com\/l\.php\?u=([^"&]+)/i;

export function extractFacebookExternalUrl(html: string): string {
  const m = html.match(FB_OUT_RE);
  if (!m) return '';
  try {
    const url = decodeURIComponent(m[1]);
    if (/facebook\.com|instagram\.com|whatsapp/i.test(url)) return '';
    return normalizeUrl(url);
  } catch {
    return '';
  }
}

const ADDR_RE = /(?:Direcci[oó]n|Address):\s*([^<\n]{6,120})/i;

function extractFacebookAddress(html: string): string {
  const m = html.match(ADDR_RE);
  return m ? m[1].trim() : '';
}

export function parseFacebookProfile(html: string): SocialProfileData {
  if (isSocialLoginWall(html)) return {};
  const email = filterEmails(extractEmails(html))[0] ?? '';
  const telefono = extractPhone(html);
  const sitioWeb = extractFacebookExternalUrl(html);
  const whatsapp = extractWhatsappLink(html);
  const direccion = extractFacebookAddress(html);
  const out: SocialProfileData = {};
  if (email) out.email = email;
  if (telefono) out.telefono = telefono;
  if (sitioWeb) out.sitioWeb = sitioWeb;
  if (whatsapp) out.whatsapp = whatsapp;
  if (direccion) out.direccion = direccion;
  return out;
}

function jsonField(html: string, key: string): string {
  // Captura el valor JSON completo respetando escapes (incluye \" \/  \uXXXX).
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
  const m = html.match(re);
  if (!m) return '';
  try {
    // Decodifica \/ , \uXXXX, \n, \" , etc. envolviendo en comillas y parseando.
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1].replace(/\\\//g, '/');
  }
}

export function parseInstagramProfile(html: string): SocialProfileData {
  if (isSocialLoginWall(html)) return {};
  const externalUrl = jsonField(html, 'external_url');
  const businessEmail = jsonField(html, 'business_email');
  const biography = jsonField(html, 'biography');
  const email = filterEmails(extractEmails(businessEmail))[0]
    || filterEmails(extractEmails(biography))[0]
    || '';
  const sitioWeb = externalUrl ? normalizeUrl(externalUrl) : '';
  const whatsapp = extractWhatsappLink(biography) || extractWhatsappLink(html);
  const out: SocialProfileData = {};
  if (email) out.email = email;
  if (sitioWeb) out.sitioWeb = sitioWeb;
  if (whatsapp) out.whatsapp = whatsapp;
  return out;
}

const SOCIAL_FILLABLE = ['email', 'telefono', 'sitioWeb', 'whatsapp', 'direccion'] as const;

export function fillEmptyFields(lead: Lead, data: SocialProfileData): Lead {
  const out: Lead = { ...lead };
  for (const key of SOCIAL_FILLABLE) {
    const value = data[key];
    if (value && out[key] === '') out[key] = value;
  }
  return out;
}
