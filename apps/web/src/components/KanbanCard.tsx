import { useDraggable } from '@dnd-kit/core';
// Import directo del subpath para evitar que Vite empaquete el resto de @leadhub/core.
import { stageColor } from '@leadhub/core/stages';
import type { PipelineCard } from '../api.js';
import ScoreBadge from './ScoreBadge.js';

/** Color estable derivado de un string (para el avatar del dueño). */
function avatarColor(seed: string): string {
  const palette = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(name: string | null): string {
  if (!name) return '–';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '–';
}

export default function KanbanCard({ card, onOpen }: { card: PipelineCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const vence = card.proximoVence ? new Date(card.proximoVence) : null;
  const vencida = vence != null && vence.getTime() < Date.now();
  const ownerBg = card.ownerNombre ? avatarColor(card.ownerId ?? card.ownerNombre) : '#cbd5e1';
  const perdidoColor = stageColor('perdido');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(card.id)}
      className={`group card p-2.5 mb-2 cursor-grab transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="font-semibold text-sm text-ink truncate">{card.nombre}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        {card.categoria && <span className="bg-parchment text-muted rounded-sm px-1.5 py-0.5 text-[11px] truncate max-w-[8rem]">{card.categoria}</span>}
        {card.localidad && <span className="truncate">📍 {card.localidad}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-on-accent"
            style={{ backgroundColor: ownerBg }}
            title={card.ownerNombre ?? 'sin dueño'}
          >
            {initials(card.ownerNombre)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {vence && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-sm ${vencida ? '' : 'bg-parchment text-muted'}`}
              style={vencida ? { backgroundColor: `${perdidoColor}1a`, color: perdidoColor } : undefined}
            >
              ⏰ {vence.toLocaleDateString()}
            </span>
          )}
          {card.pendientes > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-accent text-on-accent font-medium">{card.pendientes}</span>
          )}
          <ScoreBadge score={card.score} />
        </div>
      </div>
    </div>
  );
}
