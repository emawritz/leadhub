import { Link } from 'react-router-dom';
import type { ScrapeJob } from '../api.js';
import { jobLabel } from '../jobLabel.js';
import EmptyState from './EmptyState.js';

const STATUS_COLOR: Record<ScrapeJob['status'], string> = {
  queued: 'var(--color-muted)',
  running: 'var(--color-accent)',
  done: 'var(--color-success)',
  error: 'var(--color-danger)',
};

export default function JobsList({ jobs }: { jobs: ScrapeJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon="🔎" title="Sin búsquedas todavía" hint="Lanzá una búsqueda arriba" />;
  }
  return (
    <ul className="space-y-3 mt-6 max-w-xl">
      {jobs.map((j) => (
        <li key={j.id} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink font-medium truncate">{j.query} @ {j.location}</span>
            <span
              className="text-[13px] font-medium shrink-0"
              aria-live="polite"
              style={{ color: STATUS_COLOR[j.status] }}
            >
              {jobLabel(j)}
            </span>
          </div>
          {j.status === 'running' && j.total > 0 && (
            <div className="h-1.5 bg-parchment rounded-pill mt-3 overflow-hidden">
              <div className="h-1.5 bg-accent rounded-pill" style={{ width: `${Math.round((j.done / j.total) * 100)}%` }} />
            </div>
          )}
          {j.status === 'done' && <Link to={`/?q=${encodeURIComponent(j.query)}`} className="btn-ghost mt-3 inline-flex px-4 py-1.5 text-[13px]">Ver en el explorador</Link>}
        </li>
      ))}
    </ul>
  );
}
