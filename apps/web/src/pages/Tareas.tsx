import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { stageColor } from '@leadhub/core/stages';
import { getPendingTasks, toggleTask } from '../api.js';

export default function Tareas() {
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getPendingTasks });
  const toggle = useMutation({
    mutationFn: (id: string) => toggleTask(id, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const now = Date.now();
  const perdidoColor = stageColor('perdido');
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-ink tracking-tight mb-4">Tareas pendientes</h1>
      <ul className="space-y-2">
        {(tasks.data ?? []).map((t) => {
          const vencida = t.vence != null && new Date(t.vence).getTime() < now;
          return (
            <li key={t.id} className="card flex items-center gap-3 p-3 transition-colors hover:border-accent">
              <input type="checkbox" onChange={() => toggle.mutate(t.id)} />
              <div className="flex-1">
                <div className="text-ink">{t.titulo}</div>
                <div className="text-xs text-muted">{t.leadNombre}</div>
              </div>
              {t.vence && (
                <span
                  className={`text-xs ${vencida ? 'font-medium' : 'text-faint'}`}
                  style={vencida ? { color: perdidoColor } : undefined}
                >
                  {new Date(t.vence).toLocaleDateString()}
                </span>
              )}
            </li>
          );
        })}
        {tasks.data?.length === 0 && <li className="text-faint">Sin tareas pendientes 🎉</li>}
      </ul>
    </div>
  );
}
