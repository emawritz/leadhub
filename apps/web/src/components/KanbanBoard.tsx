import { useEffect, useState } from 'react';
import { DndContext, DragOverlay, useDroppable, type DragEndEvent, type DragStartEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoardFilter } from './BoardFilters.js';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { STAGES, CLOSED_STAGES, stageColor, stageLabel } from '@leadhub/core/stages';
import { getPipeline, updatePipeline, type PipelineCard } from '../api.js';
import { useToast } from '../toast.js';
import KanbanCard from './KanbanCard.js';
import Loading from './Loading.js';
import EmptyState from './EmptyState.js';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function Column({ stageId, label, cards, onOpen }: { stageId: string; label: string; cards: PipelineCard[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const color = stageColor(stageId);
  const closed = (CLOSED_STAGES as readonly string[]).includes(stageId);
  return (
    <div
      ref={setNodeRef}
      style={{ borderTop: `3px solid ${color}`, boxShadow: isOver ? `inset 0 0 0 2px ${color}` : undefined }}
      className={`w-64 shrink-0 rounded-lg p-2 transition-colors ${isOver ? 'bg-surface' : 'bg-parchment'}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-semibold text-ink flex items-center gap-1" role="heading" aria-level={2}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          {closed ? `✓ ${label}` : label}
        </span>
        <span className="text-xs text-faint">{cards.length}</span>
      </div>
      <div role="list" aria-label={label}>
        {cards.length === 0
          ? <div className="text-xs text-faint border border-dashed border-hairline rounded-md p-3 text-center">Vacío</div>
          : cards.map((c) => <KanbanCard key={c.id} card={c} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

export default function KanbanBoard({ onOpen, filter }: { onOpen: (id: string) => void; filter?: BoardFilter }) {
  const qc = useQueryClient();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const pipeline = useQuery({ queryKey: ['pipeline'], queryFn: getPipeline });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updatePipeline(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ['pipeline'] });
      const prev = qc.getQueryData<PipelineCard[]>(['pipeline']);
      qc.setQueryData<PipelineCard[]>(['pipeline'], (old) => (old ?? []).map((c) => (c.id === id ? { ...c, stage } : c)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['pipeline'], ctx.prev); toast.error('No se pudo mover la tarjeta'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );
  const all = pipeline.data ?? [];
  const cards = all.filter((c) => {
    if (filter?.q && !c.nombre.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if (filter?.owner === 'none' && c.ownerId != null) return false;
    if (filter?.owner && filter.owner !== 'none' && c.ownerId !== filter.owner) return false;
    if (filter?.vencidas) { const v = c.proximoVence ? new Date(c.proximoVence).getTime() : null; if (v == null || v >= Date.now()) return false; }
    return true;
  });
  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const stage = e.over ? String(e.over.id) : null;
    if (!stage) return;
    const card = cards.find((c) => c.id === id);
    if (card && card.stage !== stage) move.mutate({ id, stage });
  }

  if (pipeline.isError) return <EmptyState icon="⚠️" title="No se pudo cargar el pipeline" hint="Reintentá en un momento" />;
  if (pipeline.isLoading) return <Loading />;
  if (all.length === 0) return <EmptyState icon="📋" title="Pipeline vacío" hint="Agregá leads desde Explorar" />;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Tomaste la tarjeta ${String(active.id)}.`,
          onDragOver: ({ over }) => (over ? `Sobre la etapa ${stageLabel(String(over.id))}.` : 'Fuera de las etapas.'),
          onDragEnd: ({ over }) => (over ? `Soltaste en ${stageLabel(String(over.id))}.` : 'Cancelado.'),
          onDragCancel: () => 'Movimiento cancelado.',
        },
      }}
    >
      <div className="flex gap-3 overflow-x-auto p-4">
        {STAGES.map((s) => (
          <Column key={s.id} stageId={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id).sort((a, b) => b.score - a.score)} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {activeCard
          ? <div className={`rounded-lg ${reduced ? '' : 'ring-2 ring-accent'}`}><KanbanCard card={activeCard} onOpen={() => {}} /></div>
          : null}
      </DragOverlay>
    </DndContext>
  );
}
