import { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard.js';
// El drawer de detalle se agrega en la Task 7; por ahora onOpen solo guarda el id seleccionado.
export default function Pipeline() {
  const [, setSelected] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-xl font-bold px-4 pt-4">Pipeline</h1>
      <KanbanBoard onOpen={setSelected} />
    </div>
  );
}
