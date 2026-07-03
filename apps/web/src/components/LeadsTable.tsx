import { CLOSED_STAGES, stageLabel } from '@leadhub/core/stages';
import { scoreLead } from '@leadhub/core/score';
import type { LeadRow } from '../api.js';
import ScoreBadge from './ScoreBadge.js';

type Props = { items: LeadRow[]; pipelineByLead: Map<string, string>; onAdd: (leadId: string) => void };

function breakdown(lead: LeadRow): string {
  const signals: [string, boolean][] = [
    ['tel', !!lead.telefono],
    ['email', !!lead.email],
    ['web', !!lead.sitioWeb],
    ['redes', !!(lead.instagram || lead.facebook)],
    ['cuit', !!lead.cuit],
    ['GMaps', lead.fuente === 'Google Maps'],
  ];
  const desglose = signals.map(([label, ok]) => `${label} ${ok ? '✓' : '✗'}`).join(' · ');
  return `Prioridad ${scoreLead(lead)} — ${desglose}`;
}

export default function LeadsTable({ items, pipelineByLead, onAdd }: Props) {
  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-hairline text-muted text-[13px]">
          <tr>
            <th className="p-2">Razón social</th>
            <th className="p-2">Categoría</th>
            <th className="p-2">Localidad / Provincia</th>
            <th className="p-2">Teléfono</th>
            <th className="p-2">Email</th>
            <th className="p-2">CUIT</th>
            <th className="p-2">Fuente</th>
            <th className="p-2">Redes</th>
            <th className="p-2">Prioridad</th>
            <th className="p-2">Pipeline</th>
          </tr>
        </thead>
        <tbody>
          {items.map((lead, i) => (
            <tr key={lead.id} className="border-t border-hairline hover:bg-parchment">
              <td className="p-2 text-ink">{lead.razonSocial || lead.nombreFantasia}</td>
              <td className="p-2 text-ink">{lead.categoria}</td>
              <td className="p-2 text-ink">
                {lead.localidad}
                {lead.localidad && lead.provincia ? ', ' : ''}
                {lead.provincia}
              </td>
              <td className="p-2 text-ink">{lead.telefono}</td>
              <td className="p-2 text-ink">{lead.email}</td>
              <td className="p-2 text-ink">{lead.cuit}</td>
              <td className="p-2 text-ink">{lead.fuente}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  {lead.instagram && (
                    <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-accent underline">
                      IG
                    </a>
                  )}
                  {lead.facebook && (
                    <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-accent underline">
                      FB
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={lead.whatsapp} target="_blank" rel="noreferrer" className="text-accent underline">
                      WA
                    </a>
                  )}
                </div>
              </td>
              <td className="p-2"><ScoreBadge score={lead.score} title={breakdown(lead)} /></td>
              <td className="p-2">
                {(() => {
                  const stage = pipelineByLead.get(lead.id);
                  if (stage === undefined) return <button onClick={() => onAdd(lead.id)} className="text-sm text-accent underline">→ Pipeline</button>;
                  if ((CLOSED_STAGES as readonly string[]).includes(stage)) return <span className="text-muted text-sm">✓ {stageLabel(stage)}</span>;
                  return <span className="text-accent text-sm">✓ en pipeline</span>;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
