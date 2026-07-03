import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core
// (csv.ts/json.ts usan APIs de Node como node:fs/promises, que rompen el build de navegador).
import { STAGES, USER_ACTIVITY_TYPES } from '@leadhub/core/stages';
import { getPipelineDetail, addActivity, addTask, toggleTask, updatePipeline, removeFromPipeline } from '../api.js';

export default function LeadDrawer({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['pipeline', pipelineId], queryFn: () => getPipelineDetail(pipelineId) });
  const inval = () => { qc.invalidateQueries({ queryKey: ['pipeline', pipelineId] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); };
  const [tipo, setTipo] = useState('nota');
  const [cuerpo, setCuerpo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [vence, setVence] = useState('');
  const actMut = useMutation({ mutationFn: () => addActivity(pipelineId, { tipo, cuerpo }), onSuccess: () => { setCuerpo(''); inval(); } });
  const taskMut = useMutation({ mutationFn: () => addTask(pipelineId, { titulo, vence: vence ? new Date(vence).toISOString() : undefined }), onSuccess: () => { setTitulo(''); setVence(''); inval(); } });
  const toggleMut = useMutation({ mutationFn: (t: { id: string; hecha: boolean }) => toggleTask(t.id, t.hecha), onSuccess: inval });
  const stageMut = useMutation({ mutationFn: (stage: string) => updatePipeline(pipelineId, { stage }), onSuccess: inval });
  const delMut = useMutation({ mutationFn: () => removeFromPipeline(pipelineId), onSuccess: () => { onClose(); qc.invalidateQueries({ queryKey: ['pipeline'] }); } });

  const d = detail.data;
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-[28rem] bg-white h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        {!d ? <p>Cargando…</p> : (
          <>
            <div className="flex justify-between items-start">
              <div><h2 className="font-bold text-lg">{d.lead.nombreFantasia}</h2>
                <p className="text-sm text-gray-500">{d.lead.categoria} · {d.lead.localidad}</p>
                <p className="text-sm">{d.lead.telefono} · {d.lead.email}</p></div>
              <button onClick={onClose} className="text-gray-400">✕</button>
            </div>
            <div className="my-3">
              <label className="text-sm mr-2">Etapa</label>
              <select value={d.pipeline.stage} onChange={(e) => stageMut.mutate(e.target.value)} className="border p-1 text-sm">
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={() => delMut.mutate()} className="ml-3 text-sm text-red-600 underline">Sacar del pipeline</button>
            </div>

            <h3 className="font-semibold mt-4">Tareas</h3>
            <div className="flex gap-1 my-2">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva tarea" className="border p-1 text-sm flex-1" />
              <input type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} className="border p-1 text-sm" />
              <button disabled={!titulo || taskMut.isPending} onClick={() => taskMut.mutate()} className="bg-black text-white px-2 rounded text-sm">+</button>
            </div>
            <ul className="text-sm">
              {d.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={t.hecha} onChange={(e) => toggleMut.mutate({ id: t.id, hecha: e.target.checked })} />
                  <span className={t.hecha ? 'line-through text-gray-400' : ''}>{t.titulo}</span>
                  {t.vence && <span className="text-gray-400 text-xs">{new Date(t.vence).toLocaleDateString()}</span>}
                </li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Actividad</h3>
            <div className="flex gap-1 my-2">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border p-1 text-sm">
                {USER_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Registrar…" className="border p-1 text-sm flex-1" />
              <button disabled={!cuerpo || actMut.isPending} onClick={() => actMut.mutate()} className="bg-black text-white px-2 rounded text-sm">+</button>
            </div>
            <ul className="text-sm space-y-1">
              {d.activities.map((a) => (
                <li key={a.id} className="border-l-2 pl-2">
                  <span className="text-xs uppercase text-gray-400">{a.tipo}</span> {a.cuerpo}
                  <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
