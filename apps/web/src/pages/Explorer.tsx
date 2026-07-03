import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFacets, getLeads, downloadCsv, getPipeline, addToPipeline, bulkAddToPipeline } from '../api.js';
import { useFilters, filtersToQuery } from '../useFilters.js';
import { useToast } from '../toast.js';
import Filters from '../components/Filters.js';
import LeadsTable from '../components/LeadsTable.js';
import Loading from '../components/Loading.js';
import EmptyState from '../components/EmptyState.js';

export default function Explorer() {
  const [filters, setFilters] = useFilters();
  const qs = filtersToQuery(filters);
  const qc = useQueryClient();
  const toast = useToast();
  const facets = useQuery({ queryKey: ['facets'], queryFn: getFacets });
  const leads = useQuery({ queryKey: ['leads', qs], queryFn: () => getLeads(qs) });
  const pipeline = useQuery({ queryKey: ['pipeline'], queryFn: getPipeline });
  const add = useMutation({
    mutationFn: addToPipeline,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast.success('Agregado al pipeline'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const bulk = useMutation({
    mutationFn: () => bulkAddToPipeline(qs),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['pipeline-stats'] });
      toast.success(`${data.added} agregados · ${data.skipped} ya estaban`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const pipelineByLead = new Map((pipeline.data ?? []).map((p) => [p.leadId, p.stage] as const));

  return (
    <div className="flex gap-6 p-6 bg-canvas min-h-screen">
      <aside className="w-72 shrink-0">
        {facets.data && <Filters facets={facets.data} filters={filters} setFilters={setFilters} />}
      </aside>
      <main className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <span className="text-muted text-[15px]">{leads.data?.total ?? 0} resultados</span>
          <div className="flex gap-2 items-center">
            <select
              value={filters.sort ?? 'nombre'}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
              className="input"
            >
              <option value="prioridad">Prioridad</option>
              <option value="nombre">Nombre</option>
              <option value="localidad">Localidad</option>
              <option value="fecha">Fecha</option>
            </select>
            <button onClick={() => downloadCsv(qs)} className="btn">
              Exportar CSV
            </button>
            <button
              onClick={() => bulk.mutate()}
              disabled={bulk.isPending || !(leads.data?.total)}
              className="btn-ghost"
            >
              {bulk.isPending ? 'Agregando…' : `→ Agregar ${leads.data?.total ?? 0} al pipeline`}
            </button>
          </div>
        </div>
        {leads.isLoading || !leads.data ? (
          <Loading />
        ) : leads.data.total === 0 ? (
          <EmptyState icon="🔍" title="Sin resultados" hint="Probá con otros filtros" />
        ) : (
          <LeadsTable items={leads.data.items} pipelineByLead={pipelineByLead} onAdd={(id) => add.mutate(id)} />
        )}
      </main>
    </div>
  );
}
