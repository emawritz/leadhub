import { DndContext, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core
// (csv.ts/json.ts usan APIs de Node como node:fs/promises, que rompen el build de navegador).
import { STAGES } from '@leadhub/core/stages';
import { getPipeline, updatePipeline, type PipelineCard } from '../api.js';
import KanbanCard from './KanbanCard.js';

function Column({ stageId, label, cards, onOpen }: { stageId: string; label: string; cards: PipelineCard[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div ref={setNodeRef} className={`w-64 shrink-0 rounded p-2 ${isOver ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className="font-semibold text-sm mb-2 flex justify-between"><span>{label}</span><span className="text-gray-400">{cards.length}</span></div>
      {cards.map((c) => <KanbanCard key={c.id} card={c} onOpen={onOpen} />)}
    </div>
  );
}

export default function KanbanBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
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
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const stage = e.over ? String(e.over.id) : null;
    if (!stage) return;
    const card = cards.find((c) => c.id === id);
    if (card && card.stage !== stage) move.mutate({ id, stage });
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto p-4">
        {STAGES.map((s) => (
          <Column key={s.id} stageId={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id)} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  );
}
