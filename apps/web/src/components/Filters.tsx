import type { Facets } from '../api.js';
import type { UiFilters } from '../useFilters.js';

type Props = {
  facets: Facets;
  filters: UiFilters;
  setFilters: (f: UiFilters) => void;
};

const ARRAY_FIELDS = [
  ['provincia', 'Provincia'],
  ['localidad', 'Localidad'],
  ['categoria', 'Categoría'],
  ['fuente', 'Fuente'],
] as const;

const BOOL_FIELDS = [
  ['hasEmail', 'con email'],
  ['hasTelefono', 'con teléfono'],
  ['hasWhatsapp', 'con WhatsApp'],
  ['hasWeb', 'con sitio web'],
  ['hasCuit', 'con CUIT'],
  ['soloAlto', 'Solo prioridad Alta'],
] as const;

export default function Filters({ facets, filters, setFilters }: Props) {
  function toggleArrayValue(field: (typeof ARRAY_FIELDS)[number][0], value: string) {
    const current = filters[field] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setFilters({ ...filters, [field]: next.length ? next : undefined, page: 1 });
  }

  function toggleBool(field: (typeof BOOL_FIELDS)[number][0]) {
    setFilters({ ...filters, [field]: filters[field] ? undefined : true, page: 1 });
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="filters-q" className="block text-sm font-medium mb-1 text-ink">
          Buscar
        </label>
        <input
          id="filters-q"
          type="text"
          className="input w-full"
          placeholder="Razón social, categoría..."
          value={filters.q ?? ''}
          onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined, page: 1 })}
        />
      </div>

      <div className="space-y-1">
        {BOOL_FIELDS.map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              aria-label={label}
              checked={!!filters[field]}
              onChange={() => toggleBool(field)}
            />
            {label}
          </label>
        ))}
      </div>

      {ARRAY_FIELDS.map(([field, label]) => (
        <fieldset key={field}>
          <legend className="text-sm font-medium mb-1 text-ink">{label}</legend>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {(facets[field] ?? []).map(({ value, count }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={(filters[field] ?? []).includes(value)}
                  onChange={() => toggleArrayValue(field, value)}
                />
                <span className="flex-1">{value}</span>
                <span className="text-faint">{count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
