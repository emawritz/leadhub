import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import KanbanBoard from '../components/KanbanBoard.js';
import LeadDrawer from '../components/LeadDrawer.js';
import BoardFilters, { type BoardFilter } from '../components/BoardFilters.js';

export default function Pipeline() {
  const [selected, setSelected] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const filter: BoardFilter = { q: params.get('q') ?? '', owner: params.get('owner') ?? '', vencidas: params.get('vencidas') === '1' };
  const setFilter = (f: BoardFilter) => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.owner) p.set('owner', f.owner);
    if (f.vencidas) p.set('vencidas', '1');
    setParams(p);
  };
  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-bold text-slate-800">Pipeline</h1>
      </div>
      <BoardFilters value={filter} onChange={setFilter} />
      <KanbanBoard onOpen={setSelected} filter={filter} />
      {selected && <LeadDrawer pipelineId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
