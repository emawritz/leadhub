import { useState } from 'react';

export default function SearchForm({ onSubmit, disabled }: { onSubmit: (b: { query: string; location: string; max: number; enrich: boolean; excludeChains: boolean }) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [max, setMax] = useState(40);
  const [enrich, setEnrich] = useState(true);
  const [excludeChains, setExcludeChains] = useState(true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ query, location, max, enrich, excludeChains }); }}
      className="card space-y-4 max-w-xl p-6">
      <input aria-label="Rubro" className="input w-full" placeholder="Rubro (ej. farmacias)" value={query} onChange={(e) => setQuery(e.target.value)} />
      <input aria-label="Zona" className="input w-full" placeholder="Zona (ej. Lomas de Zamora, Buenos Aires, Argentina)" value={location} onChange={(e) => setLocation(e.target.value)} />
      <label className="flex items-center gap-2 text-[13px] text-muted">Máx <input type="number" className="input w-24 h-8 px-3" value={max} min={1} max={120} onChange={(e) => setMax(Number(e.target.value))} /></label>
      <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" aria-label="enriquecer" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} /> Enriquecer (email/CUIT/redes)</label>
      <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" aria-label="excluir cadenas" checked={excludeChains} onChange={(e) => setExcludeChains(e.target.checked)} /> Excluir cadenas</label>
      <button disabled={disabled || !query || !location} className="btn">Buscar en Google Maps</button>
    </form>
  );
}
