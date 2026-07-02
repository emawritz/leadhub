import { useQuery } from '@tanstack/react-query';
import { getFacets, getLeads, downloadCsv } from '../api.js';
import { useFilters, filtersToQuery } from '../useFilters.js';
import Filters from '../components/Filters.js';
import LeadsTable from '../components/LeadsTable.js';

export default function Explorer() {
  const [filters, setFilters] = useFilters();
  const qs = filtersToQuery(filters);
  const facets = useQuery({ queryKey: ['facets'], queryFn: getFacets });
  const leads = useQuery({ queryKey: ['leads', qs], queryFn: () => getLeads(qs) });

  return (
    <div className="flex gap-6 p-6">
      <aside className="w-72 shrink-0">
        {facets.data && <Filters facets={facets.data} filters={filters} setFilters={setFilters} />}
      </aside>
      <main className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <span>{leads.data?.total ?? 0} resultados</span>
          <button onClick={() => downloadCsv(qs)} className="bg-black text-white px-4 py-2 rounded">
            Exportar CSV
          </button>
        </div>
        {leads.data && <LeadsTable items={leads.data.items} />}
      </main>
    </div>
  );
}
