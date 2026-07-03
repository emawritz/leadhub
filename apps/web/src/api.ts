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
// El endpoint /leads devuelve la fila completa de la tabla `leads` (incluye `id`),
// que no forma parte del tipo `Lead` de @leadhub/core (representa el lead "crudo" pre-inserción).
export type LeadRow = Lead & { id: string; score: number };
export const getLeads = (qs: string) => req<{ items: LeadRow[]; total: number; page: number; pageSize: number }>(`/leads?${qs}`);

export interface ScrapeJob {
  id: string; query: string; location: string;
  status: 'queued' | 'running' | 'done' | 'error';
  phase: string; done: number; total: number;
  leadsFound: number; inserted: number; updated: number; error: string;
  createdAt: string;
}
export const createScrape = (body: { query: string; location: string; max?: number; enrich?: boolean; excludeChains?: boolean }) =>
  req<ScrapeJob>('/scrape', { method: 'POST', body: JSON.stringify(body) });
export const listScrapes = () => req<ScrapeJob[]>('/scrape');

export interface PipelineCard {
  id: string; stage: string; ownerId: string | null; ownerNombre: string | null;
  leadId: string; nombre: string; categoria: string; localidad: string; telefono: string; email: string;
  pendientes: number;
  proximoVence: string | null;
  score: number;
}
export interface PipelineLeadRow {
  id: string; leadId: string; ownerId: string | null; stage: string; createdAt: string; updatedAt: string;
}
export interface Activity { id: string; tipo: string; cuerpo: string; createdAt: string; }
export interface Task { id: string; titulo: string; vence: string | null; hecha: boolean; completedAt: string | null; }
export interface PipelineDetail { pipeline: { id: string; stage: string; ownerId: string | null }; lead: Lead; activities: Activity[]; tasks: Task[]; }
export interface PendingTask { id: string; titulo: string; vence: string | null; hecha: boolean; pipelineLeadId: string; leadNombre: string; }

export interface PipelineStats {
  porEtapa: Record<string, number>; total: number; ganado: number; perdido: number; conversion: number; tareasVencidas: number;
}
export const getPipelineStats = () => req<PipelineStats>('/pipeline/stats');

export interface Account { id: string; email: string; nombre: string | null; }
export const getAccounts = () => req<Account[]>('/accounts');

export const getPipeline = () => req<PipelineCard[]>('/pipeline');
export const addToPipeline = (leadId: string) => req<{ id: string }>('/pipeline', { method: 'POST', body: JSON.stringify({ leadId }) });
export const bulkAddToPipeline = (qs: string) =>
  req<{ matched: number; added: number; skipped: number }>(`/pipeline/bulk?${qs}`, { method: 'POST' });
export const updatePipeline = (id: string, body: { stage?: string; ownerId?: string | null }) => req<PipelineLeadRow>(`/pipeline/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeFromPipeline = (id: string) => req<{ id: string }>(`/pipeline/${id}`, { method: 'DELETE' });
export const getPipelineDetail = (id: string) => req<PipelineDetail>(`/pipeline/${id}`);
export const addActivity = (id: string, body: { tipo: string; cuerpo: string }) => req<Activity>(`/pipeline/${id}/activities`, { method: 'POST', body: JSON.stringify(body) });
export const addTask = (id: string, body: { titulo: string; vence?: string }) => req<Task>(`/pipeline/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) });
export const toggleTask = (taskId: string, hecha: boolean) => req<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ hecha }) });
export const getPendingTasks = () => req<PendingTask[]>('/tasks');

export async function downloadCsv(qs: string) {
  const res = await fetch(`/api/leads/export?${qs}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('No se pudo exportar');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'leads.csv'; a.click();
  URL.revokeObjectURL(a.href);
}
