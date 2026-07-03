import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFacets, getLeads, downloadCsv, getPipeline, addToPipeline } from '../api.js';
import { useFilters, filtersToQuery } from '../useFilters.js';
import Filters from '../components/Filters.js';
import LeadsTable from '../components/LeadsTable.js';

export default function Explorer() {
  const [filters, setFilters] = useFilters();
  const qs = filtersToQuery(filters);
  const qc = useQueryClient();
  const facets = useQuery({ queryKey: ['facets'], queryFn: getFacets });
  const leads = useQuery({ queryKey: ['leads', qs], queryFn: () => getLeads(qs) });
  const pipeline = useQuery({ queryKey: ['pipeline'], queryFn: getPipeline });
  const add = useMutation({ mutationFn: addToPipeline, onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline'] }) });
  const pipelineByLead = new Map((pipeline.data ?? []).map((p) => [p.leadId, p.stage] as const));

  return (
    <div className="flex gap-6 p-6 bg-canvas min-h-screen">
      <aside className="w-72 shrink-0">
        {facets.data && <Filters facets={facets.data} filters={filters} setFilters={setFilters} />}
      </aside>
      <main className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <span className="text-muted text-[15px]">{leads.data?.total ?? 0} resultados</span>
          <button onClick={() => downloadCsv(qs)} className="btn">
            Exportar CSV
          </button>
        </div>
        {leads.data && (
          <LeadsTable items={leads.data.items} pipelineByLead={pipelineByLead} onAdd={(id) => add.mutate(id)} />
        )}
      </main>
    </div>
  );
}
