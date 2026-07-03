import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createScrape, listScrapes } from '../api.js';
import SearchForm from '../components/SearchForm.js';
import JobsList from '../components/JobsList.js';

export default function Buscar() {
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ['scrapes'], queryFn: listScrapes, refetchInterval: 2000 });
  const mut = useMutation({ mutationFn: createScrape, onSuccess: () => qc.invalidateQueries({ queryKey: ['scrapes'] }) });
  return (
    <div className="min-h-screen bg-canvas p-6">
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-6">Buscar en Google Maps</h1>
      <SearchForm disabled={mut.isPending} onSubmit={(b) => mut.mutate(b)} />
      {jobs.data && <JobsList jobs={jobs.data} />}
    </div>
  );
}
