import { useDraggable } from '@dnd-kit/core';
import type { PipelineCard } from '../api.js';

export default function KanbanCard({ card, onOpen }: { card: PipelineCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => onOpen(card.id)}
      className={`border rounded bg-white p-2 mb-2 cursor-grab shadow-sm ${isDragging ? 'opacity-50' : ''}`}>
      <div className="font-medium text-sm">{card.nombre}</div>
      <div className="text-xs text-gray-500">{card.categoria} · {card.localidad}</div>
      <div className="flex justify-between items-center mt-1 text-xs">
        <span className="text-gray-400">{card.ownerNombre ?? 'sin dueño'}</span>
        {card.pendientes > 0 && <span className="bg-amber-100 text-amber-700 px-1.5 rounded">{card.pendientes} tareas</span>}
      </div>
    </div>
  );
}
