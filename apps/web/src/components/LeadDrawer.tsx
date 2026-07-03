import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { STAGES, USER_ACTIVITY_TYPES, ACTIVITY_META, stageColor } from '@leadhub/core/stages';
import { getPipelineDetail, addActivity, addTask, toggleTask, updatePipeline, removeFromPipeline, getAccounts } from '../api.js';
import Loading from './Loading.js';

function soloDigitos(tel: string | null | undefined): string { return (tel ?? '').replace(/\D/g, ''); }

const NEUTRAL = { icon: '•', color: '#94a3b8' };

export default function LeadDrawer({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['pipeline', pipelineId], queryFn: () => getPipelineDetail(pipelineId) });
  const inval = () => { qc.invalidateQueries({ queryKey: ['pipeline', pipelineId] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); };
  const [tipo, setTipo] = useState('nota');
  const [cuerpo, setCuerpo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [vence, setVence] = useState('');
  const actMut = useMutation({ mutationFn: () => addActivity(pipelineId, { tipo, cuerpo }), onSuccess: () => { setCuerpo(''); inval(); } });
  const taskMut = useMutation({ mutationFn: () => addTask(pipelineId, { titulo, vence: vence ? new Date(vence).toISOString() : undefined }), onSuccess: () => { setTitulo(''); setVence(''); inval(); } });
  const toggleMut = useMutation({ mutationFn: (t: { id: string; hecha: boolean }) => toggleTask(t.id, t.hecha), onSuccess: inval });
  const stageMut = useMutation({ mutationFn: (stage: string) => updatePipeline(pipelineId, { stage }), onSuccess: inval });
  const delMut = useMutation({ mutationFn: () => removeFromPipeline(pipelineId), onSuccess: () => { onClose(); qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); } });
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const ownerMut = useMutation({ mutationFn: (ownerId: string | null) => updatePipeline(pipelineId, { ownerId }), onSuccess: inval });
  const outreachMut = useMutation({ mutationFn: (v: { tipo: string; cuerpo: string }) => addActivity(pipelineId, v), onSuccess: inval });

  const d = detail.data;
  const selectCls = 'border border-hairline bg-surface text-ink rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent';
  const composerCls = 'border border-hairline bg-surface text-ink rounded-md px-2 py-1 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent';
  const addBtnCls = 'bg-accent text-on-accent px-2.5 rounded-md text-sm transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100';
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-[28rem] bg-surface border-l border-hairline h-full overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        {!d ? <Loading /> : (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg text-ink tracking-tight">{d.lead.nombreFantasia}</h2>
                <p className="text-sm text-muted">{d.lead.categoria} · {d.lead.localidad}</p>
                <p className="text-sm text-muted">{d.lead.telefono} · {d.lead.email}</p>
              </div>
              <button onClick={onClose} className="text-faint hover:text-ink text-lg leading-none">✕</button>
            </div>

            <div className="mt-3 flex gap-2">
              {soloDigitos(d.lead.telefono) && (
                <a
                  href={`https://wa.me/${soloDigitos(d.lead.telefono)}?text=${encodeURIComponent(`Hola ${d.lead.nombreFantasia ?? ''}, `)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => outreachMut.mutate({ tipo: 'whatsapp', cuerpo: 'Mensaje iniciado por WhatsApp' })}
                  className="btn"
                >
                  💬 WhatsApp
                </a>
              )}
              {d.lead.email && (
                <a
                  href={`mailto:${encodeURIComponent(d.lead.email)}?subject=${encodeURIComponent('Contacto')}&body=${encodeURIComponent(`Hola ${d.lead.nombreFantasia ?? ''}, `)}`}
                  onClick={() => outreachMut.mutate({ tipo: 'email', cuerpo: 'Mensaje iniciado por email' })}
                  className="btn-ghost"
                >
                  ✉️ Email
                </a>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageColor(d.pipeline.stage) }} />
                Etapa
              </span>
              <select value={d.pipeline.stage} onChange={(e) => stageMut.mutate(e.target.value)} className={selectCls}>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={() => delMut.mutate()} className="ml-auto text-sm font-medium hover:underline" style={{ color: stageColor('perdido') }}>Sacar</button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-medium text-muted">Dueño</span>
              <select
                value={d.pipeline.ownerId ?? ''}
                onChange={(e) => ownerMut.mutate(e.target.value === '' ? null : e.target.value)}
                className={selectCls}
              >
                <option value="">Sin asignar</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>)}
              </select>
            </div>

            <h3 className="font-semibold text-ink tracking-tight mt-6 mb-2">Tareas</h3>
            <div className="flex gap-1.5 mb-2">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva tarea" className={`${composerCls} flex-1`} />
              <input type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} className={composerCls} />
              <button disabled={!titulo || taskMut.isPending} onClick={() => taskMut.mutate()} className={addBtnCls}>+</button>
            </div>
            <ul className="text-sm space-y-1">
              {d.tasks.map((t) => {
                const venc = t.vence ? new Date(t.vence) : null;
                const vencida = venc != null && venc.getTime() < Date.now() && !t.hecha;
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={t.hecha} onChange={(e) => toggleMut.mutate({ id: t.id, hecha: e.target.checked })} />
                    <span className={`flex-1 ${t.hecha ? 'line-through text-faint' : 'text-ink'}`}>{t.titulo}</span>
                    {venc && (
                      <span className={`text-xs ${vencida ? 'font-medium' : 'text-faint'}`} style={vencida ? { color: stageColor('perdido') } : undefined}>
                        {venc.toLocaleDateString()}
                      </span>
                    )}
                  </li>
                );
              })}
              {d.tasks.length === 0 && <li className="text-faint text-xs">Sin tareas</li>}
            </ul>

            <h3 className="font-semibold text-ink tracking-tight mt-6 mb-2">Actividad</h3>
            <div className="flex gap-1.5 mb-3">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
                {USER_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Registrar…" className={`${composerCls} flex-1`} />
              <button disabled={!cuerpo || actMut.isPending} onClick={() => actMut.mutate()} className={addBtnCls}>+</button>
            </div>
            <ul className="space-y-2">
              {d.activities.map((a) => {
                const meta = (ACTIVITY_META as Record<string, { icon: string; color: string }>)[a.tipo] ?? NEUTRAL;
                return (
                  <li key={a.id} className="pl-3 py-0.5" style={{ borderLeft: `3px solid ${meta.color}` }}>
                    <div className="text-sm text-ink"><span className="mr-1">{meta.icon}</span><span className="text-xs uppercase tracking-wide text-faint mr-1">{a.tipo}</span>{a.cuerpo}</div>
                    <div className="text-xs text-faint">{new Date(a.createdAt).toLocaleString()}</div>
                  </li>
                );
              })}
              {d.activities.length === 0 && <li className="text-faint text-xs">Sin actividad todavía</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
