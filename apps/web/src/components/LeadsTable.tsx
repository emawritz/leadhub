import { stageColor, stageLabel } from '@leadhub/core/stages';
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
    ['wa', !!lead.whatsapp],
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
        <caption className="sr-only">Listado de leads filtrados</caption>
        <thead className="border-b border-hairline text-muted text-[13px]">
          <tr>
            <th scope="col" className="p-2">Lead</th>
            <th scope="col" className="p-2">Ubicación</th>
            <th scope="col" className="p-2">Contacto</th>
            <th scope="col" className="p-2">Datos</th>
            <th scope="col" className="p-2">Prioridad</th>
            <th scope="col" className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((lead, i) => (
            <tr key={lead.id} className="border-t border-hairline hover:bg-parchment">
              <td className="p-2 align-top">
                <div className="text-ink font-medium truncate max-w-[16rem]">{lead.razonSocial || lead.nombreFantasia}</div>
                <div className="text-muted text-[12px] truncate">{lead.categoria}</div>
              </td>
              <td className="p-2 align-top text-muted text-[13px]">
                {lead.localidad}
                {lead.localidad && lead.provincia ? ', ' : ''}
                {lead.provincia}
              </td>
              <td className="p-2 align-top">
                <div className="text-ink text-[13px]">{lead.telefono}</div>
                <div className="text-muted text-[12px] truncate">{lead.email}</div>
                <div className="flex gap-2 text-accent text-[12px]">
                  {lead.instagram && (
                    <a href={lead.instagram} target="_blank" rel="noreferrer" aria-label={`Instagram de ${lead.razonSocial || lead.nombreFantasia}`} className="underline">
                      IG
                    </a>
                  )}
                  {lead.facebook && (
                    <a href={lead.facebook} target="_blank" rel="noreferrer" aria-label={`Facebook de ${lead.razonSocial || lead.nombreFantasia}`} className="underline">
                      FB
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={lead.whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${lead.razonSocial || lead.nombreFantasia}`} className="underline">
                      WA
                    </a>
                  )}
                </div>
              </td>
              <td className="p-2 align-top">
                <div className="text-ink text-[13px]">{lead.cuit}</div>
                <div className="text-muted text-[12px]">{lead.fuente}</div>
              </td>
              <td className="p-2 align-top"><ScoreBadge score={lead.score} title={breakdown(lead)} /></td>
              <td className="p-2 align-top">
                {(() => {
                  const stage = pipelineByLead.get(lead.id);
                  if (stage === undefined) return <button onClick={() => onAdd(lead.id)} className="text-sm text-accent underline">→ Pipeline</button>;
                  return (
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                      <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: stageColor(stage) }} />
                      {stageLabel(stage)}
                    </span>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
