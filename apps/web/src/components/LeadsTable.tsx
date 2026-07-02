import type { Lead } from '@leadhub/core';

type Props = { items: Lead[] };

export default function LeadsTable({ items }: Props) {
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
          </tr>
        </thead>
        <tbody>
          {items.map((lead, i) => (
            <tr key={`${lead.razonSocial}-${i}`} className="border-t">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
