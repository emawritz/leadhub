import { useState } from 'react';

export default function SearchForm({ onSubmit, disabled }: { onSubmit: (b: { query: string; location: string; max: number; enrich: boolean; excludeChains: boolean }) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [max, setMax] = useState(40);
  const [enrich, setEnrich] = useState(true);
  const [excludeChains, setExcludeChains] = useState(true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ query, location, max, enrich, excludeChains }); }}
      className="space-y-3 max-w-xl border rounded p-4">
      <input className="border p-2 w-full" placeholder="Rubro (ej. farmacias)" value={query} onChange={(e) => setQuery(e.target.value)} />
      <input className="border p-2 w-full" placeholder="Zona (ej. Lomas de Zamora, Buenos Aires, Argentina)" value={location} onChange={(e) => setLocation(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">Máx <input type="number" className="border p-1 w-24" value={max} min={1} max={120} onChange={(e) => setMax(Number(e.target.value))} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="enriquecer" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} /> Enriquecer (email/CUIT/redes)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="excluir cadenas" checked={excludeChains} onChange={(e) => setExcludeChains(e.target.checked)} /> Excluir cadenas</label>
      <button disabled={disabled || !query || !location} className="bg-black text-white px-4 py-2 rounded disabled:opacity-40">Buscar en Google Maps</button>
    </form>
  );
}
