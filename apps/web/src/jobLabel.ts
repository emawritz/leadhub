import type { ScrapeJob } from './api.js';

export function jobLabel(job: ScrapeJob): string {
  switch (job.status) {
    case 'queued': return 'En cola';
    case 'running': return `Corriendo ${job.done}/${job.total}`;
    case 'done': return `Listo · ${job.leadsFound} encontrados · ${job.inserted} nuevos`;
    case 'error': return `Error: ${job.error}`;
    default: return job.status;
  }
}
