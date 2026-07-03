import { useQuery } from '@tanstack/react-query';
import { STAGES, stageColor } from '@leadhub/core/stages';
import { getPipelineStats } from '../api.js';
import Loading from '../components/Loading.js';

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4 flex-1" style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>
      <div className="text-2xl font-semibold text-ink tracking-tight">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useQuery({ queryKey: ['pipeline-stats'], queryFn: getPipelineStats });
  const s = stats.data;
  const max = s ? Math.max(1, ...Object.values(s.porEtapa)) : 1;
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-ink tracking-tight mb-4">Dashboard</h1>
      {!s ? <Loading /> : (
        <>
          <div className="flex gap-3 mb-6">
            <Metric label="En pipeline" value={String(s.total)} />
            <Metric label="Conversión" value={`${Math.round(s.conversion * 100)}%`} accent={stageColor('ganado')} />
            <Metric label="Tareas vencidas" value={String(s.tareasVencidas)} accent={s.tareasVencidas > 0 ? stageColor('perdido') : undefined} />
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-ink mb-3">Embudo por etapa</h2>
            <div className="space-y-2">
              {STAGES.map((st) => {
                const n = s.porEtapa[st.id] ?? 0;
                const pct = Math.round((n / max) * 100);
                return (
                  <div key={st.id} className="flex items-center gap-3">
                    <span className="text-sm text-muted w-28 shrink-0">{st.label}</span>
                    <div className="flex-1 bg-parchment rounded h-5 overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: stageColor(st.id) }} />
                    </div>
                    <span className="text-sm text-muted w-8 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
