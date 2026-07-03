import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingTasks, toggleTask } from '../api.js';

export default function Tareas() {
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getPendingTasks });
  const toggle = useMutation({
    mutationFn: (id: string) => toggleTask(id, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const now = Date.now();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">Tareas pendientes</h1>
      <ul className="space-y-2">
        {(tasks.data ?? []).map((t) => {
          const vencida = t.vence != null && new Date(t.vence).getTime() < now;
          return (
            <li key={t.id} className="flex items-center gap-3 border rounded p-2">
              <input type="checkbox" onChange={() => toggle.mutate(t.id)} />
              <div className="flex-1">
                <div>{t.titulo}</div>
                <div className="text-xs text-gray-500">{t.leadNombre}</div>
              </div>
              {t.vence && <span className={`text-xs ${vencida ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{new Date(t.vence).toLocaleDateString()}</span>}
            </li>
          );
        })}
        {tasks.data?.length === 0 && <li className="text-gray-400">Sin tareas pendientes 🎉</li>}
      </ul>
    </div>
  );
}
