import { Link } from 'react-router-dom';
import type { ScrapeJob } from '../api.js';
import { jobLabel } from '../jobLabel.js';

export default function JobsList({ jobs }: { jobs: ScrapeJob[] }) {
  return (
    <ul className="space-y-2 mt-6">
      {jobs.map((j) => (
        <li key={j.id} className="border rounded p-3">
          <div className="flex justify-between">
            <span className="font-medium">{j.query} @ {j.location}</span>
            <span className="text-sm text-gray-600">{jobLabel(j)}</span>
          </div>
          {j.status === 'running' && j.total > 0 && (
            <div className="h-1.5 bg-gray-200 rounded mt-2"><div className="h-1.5 bg-black rounded" style={{ width: `${Math.round((j.done / j.total) * 100)}%` }} /></div>
          )}
          {j.status === 'done' && <Link to="/" className="text-sm underline">Ver en el explorador</Link>}
        </li>
      ))}
    </ul>
  );
}
