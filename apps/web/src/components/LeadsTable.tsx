import { CLOSED_STAGES, stageLabel } from '@leadhub/core/stages';
import type { LeadRow } from '../api.js';

type Props = { items: LeadRow[]; pipelineByLead: Map<string, string>; onAdd: (leadId: string) => void };

export default function LeadsTable({ items, pipelineByLead, onAdd }: Props) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Razón social</th>
            <th className="p-2">Categoría</th>
            <th className="p-2">Localidad / Provincia</th>
            <th className="p-2">Teléfono</th>
            <th className="p-2">Email</th>
            <th className="p-2">CUIT</th>
            <th className="p-2">Fuente</th>
            <th className="p-2">Redes</th>
            <th className="p-2">Pipeline</th>
          </tr>
        </thead>
        <tbody>
          {items.map((lead, i) => (
            <tr key={lead.id} className="border-t">
              <td className="p-2">{lead.razonSocial || lead.nombreFantasia}</td>
              <td className="p-2">{lead.categoria}</td>
              <td className="p-2">
                {lead.localidad}
                {lead.localidad && lead.provincia ? ', ' : ''}
                {lead.provincia}
              </td>
              <td className="p-2">{lead.telefono}</td>
              <td className="p-2">{lead.email}</td>
              <td className="p-2">{lead.cuit}</td>
              <td className="p-2">{lead.fuente}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  {lead.instagram && (
                    <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      IG
                    </a>
                  )}
                  {lead.facebook && (
                    <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      FB
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={lead.whatsapp} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      WA
                    </a>
                  )}
                </div>
              </td>
              <td className="p-2">
                {(() => {
                  const stage = pipelineByLead.get(lead.id);
                  if (stage === undefined) return <button onClick={() => onAdd(lead.id)} className="text-sm underline">→ Pipeline</button>;
                  if ((CLOSED_STAGES as readonly string[]).includes(stage)) return <span className="text-gray-500 text-sm">✓ {stageLabel(stage)}</span>;
                  return <span className="text-green-600 text-sm">✓ en pipeline</span>;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
