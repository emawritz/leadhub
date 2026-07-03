import { useState } from 'react';
import { DndContext, DragOverlay, useDroppable, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { STAGES, CLOSED_STAGES, stageColor } from '@leadhub/core/stages';
import { getPipeline, updatePipeline, type PipelineCard } from '../api.js';
import KanbanCard from './KanbanCard.js';

function useReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Column({ stageId, label, cards, onOpen }: { stageId: string; label: string; cards: PipelineCard[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const color = stageColor(stageId);
  const closed = (CLOSED_STAGES as readonly string[]).includes(stageId);
  return (
    <div
      ref={setNodeRef}
      style={{ borderTop: `3px solid ${color}`, boxShadow: isOver ? `inset 0 0 0 2px ${color}` : undefined }}
      className={`w-64 shrink-0 rounded-lg p-2 transition-colors ${isOver ? 'bg-slate-100' : 'bg-slate-50'}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          {closed ? `✓ ${label}` : label}
        </span>
        <span className="text-xs text-slate-400">{cards.length}</span>
      </div>
      {cards.length === 0
        ? <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-3 text-center">Vacío</div>
        : cards.map((c) => <KanbanCard key={c.id} card={c} onOpen={onOpen} />)}
    </div>
  );
}

export default function KanbanBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
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
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['pipeline'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pipeline'] }),
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const cards = pipeline.data ?? [];
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

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto p-4">
        {STAGES.map((s) => (
          <Column key={s.id} stageId={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id)} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {activeCard
          ? <div className={reduced ? '' : 'shadow-xl rounded-lg'}><KanbanCard card={activeCard} onOpen={() => {}} /></div>
          : null}
      </DragOverlay>
    </DndContext>
  );
}
