import type { Lead } from '@leadhub/core';

let token: string | null = localStorage.getItem('token');
export const setToken = (t: string | null) => { token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); };
export const getToken = () => token;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? 'Error');
  return json.data as T;
}

export const login = (email: string, password: string) => req<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export type Facets = Record<'provincia' | 'localidad' | 'categoria' | 'fuente', { value: string; count: number }[]>;
export const getFacets = () => req<Facets>('/leads/facets');
export const getLeads = (qs: string) => req<{ items: Lead[]; total: number; page: number; pageSize: number }>(`/leads?${qs}`);
export const exportUrl = (qs: string) => `/api/leads/export?${qs}`;

export async function downloadCsv(qs: string) {
  const res = await fetch(`/api/leads/export?${qs}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'leads.csv'; a.click();
  URL.revokeObjectURL(a.href);
}
