import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../api.js';

export type BoardFilter = { q: string; owner: string; vencidas: boolean };

export default function BoardFilters({ value, onChange }: { value: BoardFilter; onChange: (f: BoardFilter) => void }) {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <input
        aria-label="Buscar por nombre"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        placeholder="Buscar por nombre…"
        className="input w-56"
      />
      <select
        aria-label="Filtrar por dueño"
        value={value.owner}
        onChange={(e) => onChange({ ...value, owner: e.target.value })}
        className="border border-hairline rounded-md bg-surface px-2 py-1 text-sm text-ink"
      >
        <option value="">Todos los dueños</option>
        <option value="none">Sin dueño</option>
        {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-muted">
        <input type="checkbox" checked={value.vencidas} onChange={(e) => onChange({ ...value, vencidas: e.target.checked })} />
        Con vencidas
      </label>
      {(value.q || value.owner || value.vencidas) && (
        <button onClick={() => onChange({ q: '', owner: '', vencidas: false })} className="text-sm text-accent hover:underline">Limpiar</button>
      )}
    </div>
  );
}
