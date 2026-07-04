import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { STAGES, USER_ACTIVITY_TYPES, ACTIVITY_META, stageColor } from '@leadhub/core/stages';
import { getPipelineDetail, addActivity, addTask, toggleTask, updatePipeline, removeFromPipeline, getAccounts } from '../api.js';
import { useToast } from '../toast.js';
import Loading from './Loading.js';
import EmptyState from './EmptyState.js';

function soloDigitos(tel: string | null | undefined): string { return (tel ?? '').replace(/\D/g, ''); }

const NEUTRAL = { icon: '•', color: '#94a3b8' };

export default function LeadDrawer({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const trapFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const qc = useQueryClient();
  const toast = useToast();
  const detail = useQuery({ queryKey: ['pipeline', pipelineId], queryFn: () => getPipelineDetail(pipelineId) });
  const inval = () => { qc.invalidateQueries({ queryKey: ['pipeline', pipelineId] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); };
  const [tipo, setTipo] = useState('nota');
  const [cuerpo, setCuerpo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [vence, setVence] = useState('');
  const actMut = useMutation({
    mutationFn: () => addActivity(pipelineId, { tipo, cuerpo }),
    onSuccess: () => { setCuerpo(''); inval(); toast.success('Actividad registrada'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const taskMut = useMutation({
    mutationFn: () => addTask(pipelineId, { titulo, vence: vence ? new Date(vence).toISOString() : undefined }),
    onSuccess: () => { setTitulo(''); setVence(''); inval(); toast.success('Tarea agregada'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggleMut = useMutation({ mutationFn: (t: { id: string; hecha: boolean }) => toggleTask(t.id, t.hecha), onSuccess: inval });
  const stageMut = useMutation({
    mutationFn: (stage: string) => updatePipeline(pipelineId, { stage }),
    onSuccess: () => { inval(); toast.success('Etapa actualizada'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delMut = useMutation({
    mutationFn: () => removeFromPipeline(pipelineId),
    onSuccess: () => { onClose(); qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); toast.success('Sacado del pipeline'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const ownerMut = useMutation({
    mutationFn: (ownerId: string | null) => updatePipeline(pipelineId, { ownerId }),
    onSuccess: () => { inval(); toast.success('Dueño actualizado'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const outreachMut = useMutation({
    mutationFn: (v: { tipo: string; cuerpo: string }) => addActivity(pipelineId, v),
    onSuccess: () => { inval(); toast.success('Actividad registrada'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = detail.data;
  const focusedOnceRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!d || focusedOnceRef.current) return;
    panelRef.current?.querySelector<HTMLElement>('#drawer-title')?.focus();
    focusedOnceRef.current = true;
  }, [d]);
  const selectCls = 'border border-hairline bg-surface text-ink rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent';
  const composerCls = 'border border-hairline bg-surface text-ink rounded-md px-2 py-1 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent';
  const addBtnCls = 'bg-accent text-on-accent px-2.5 rounded-md text-sm transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100';
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="w-[28rem] bg-surface border-l border-hairline h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
      >
        {detail.isError ? (
          <EmptyState icon="⚠️" title="No se pudo cargar el lead" />
        ) : !d ? (
          <Loading />
        ) : (
          <>
            {/* Cabecera */}
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 id="drawer-title" tabIndex={-1} className="font-semibold text-lg text-ink tracking-tight">{d.lead.nombreFantasia}</h2>
                  <p className="text-sm text-muted">{d.lead.categoria} · {d.lead.localidad}</p>
                  <p className="text-sm text-muted">{d.lead.telefono} · {d.lead.email}</p>
                </div>
                <button onClick={onClose} aria-label="Cerrar" className="text-faint hover:text-ink text-lg leading-none">✕</button>
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
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                )}
                {d.lead.email && (
                  <a
                    href={`mailto:${encodeURIComponent(d.lead.email)}?subject=${encodeURIComponent('Contacto')}&body=${encodeURIComponent(`Hola ${d.lead.nombreFantasia ?? ''}, `)}`}
                    onClick={() => outreachMut.mutate({ tipo: 'email', cuerpo: 'Mensaje iniciado por email' })}
                    className="btn-ghost"
                  >
                    <span aria-hidden="true">✉️</span> Email
                  </a>
                )}
              </div>
            </div>

            {/* Meta: Etapa + Dueño */}
            <div className="border-t border-hairline pt-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageColor(d.pipeline.stage) }} />
                  Etapa
                </span>
                <select aria-label="Etapa" value={d.pipeline.stage} onChange={(e) => stageMut.mutate(e.target.value)} className={selectCls}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button onClick={() => delMut.mutate()} className="ml-auto text-sm font-medium text-danger hover:underline">Sacar</button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium text-muted">Dueño</span>
                <select
                  aria-label="Dueño"
                  value={d.pipeline.ownerId ?? ''}
                  onChange={(e) => ownerMut.mutate(e.target.value === '' ? null : e.target.value)}
                  className={selectCls}
                >
                  <option value="">Sin asignar</option>
                  {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>)}
                </select>
              </div>
            </div>

            {/* Tareas */}
            <div className="border-t border-hairline pt-4 mt-4">
              <h3 className="font-semibold text-ink tracking-tight mb-2">Tareas</h3>
              <div className="flex gap-1.5 mb-2">
                <input aria-label="Nueva tarea" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva tarea" className={`${composerCls} flex-1`} />
                <input aria-label="Vencimiento de la tarea" type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} className={composerCls} />
                <button aria-label="Agregar tarea" disabled={!titulo || taskMut.isPending} onClick={() => taskMut.mutate()} className={addBtnCls}>+</button>
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
                        <span className={`text-xs ${vencida ? 'font-medium text-danger' : 'text-faint'}`}>
                          {venc.toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  );
                })}
                {d.tasks.length === 0 && <li className="text-faint text-xs">Sin tareas</li>}
              </ul>
            </div>

            {/* Actividad */}
            <div className="border-t border-hairline pt-4 mt-4">
              <h3 className="font-semibold text-ink tracking-tight mb-2">Actividad</h3>
              <div className="flex gap-1.5 mb-3">
                <select aria-label="Tipo de actividad" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
                  {USER_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input aria-label="Registrar actividad" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Registrar…" className={`${composerCls} flex-1`} />
                <button aria-label="Registrar actividad" disabled={!cuerpo || actMut.isPending} onClick={() => actMut.mutate()} className={addBtnCls}>+</button>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
