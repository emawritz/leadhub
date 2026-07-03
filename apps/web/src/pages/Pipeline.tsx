import { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard.js';
import LeadDrawer from '../components/LeadDrawer.js';

export default function Pipeline() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-xl font-bold px-4 pt-4">Pipeline</h1>
      <KanbanBoard onOpen={setSelected} />
      {selected && <LeadDrawer pipelineId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
