import Link from 'next/link'
import { getTender } from '@/lib/api'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format'
import ActionButton from '@/components/ActionButton'
import AnalysisView from '@/components/AnalysisView'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ slug: string }>
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{String(value)}</dd>
    </div>
  )
}

export default async function TenderPage({ params }: PageProps) {
  const { slug } = await params

  let tender
  try {
    tender = await getTender(slug)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('404')) notFound()
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
        Error loading tender: {msg}
      </div>
    )
  }

  const hasDetail = Boolean(tender.procedure_type || tender.publications)
  const hasAnalysis = Boolean(tender.analysis)
  const rec = tender.analysis?.summary?.recommendation

  const recStyle = rec
    ? { GREEN: 'bg-green-100 text-green-800', AMBER: 'bg-amber-100 text-amber-800', RED: 'bg-red-100 text-red-800' }[rec]
    : ''

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-700">Licitaciones</Link>
        <span>/</span>
        <span className="font-mono text-slate-700">{tender.expediente}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-slate-400 mb-1">{tender.expediente}</p>
            <h1 className="text-xl font-semibold text-slate-900 leading-snug">{tender.description || 'Sin descripción'}</h1>
            <p className="text-sm text-slate-500 mt-1">{tender.contracting_authority}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tender.status}</span>
            {rec && <span className={`text-xs font-bold px-3 py-1 rounded-full ${recStyle}`}>{rec}</span>}
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Información básica</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Presupuesto" value={formatCurrency(tender.budget)} />
          <InfoRow label="Valor estimado" value={formatCurrency(tender.estimated_value)} />
          <InfoRow label="Plazo de presentación" value={formatDateTime(tender.submission_deadline)} />
          <InfoRow label="Tipo de contrato" value={tender.contract_type} />
          <InfoRow label="Subtipo" value={tender.contract_subtype} />
          <InfoRow label="Última actualización" value={formatDate(tender.last_updated)} />
          {tender.awardee && <InfoRow label="Adjudicatario" value={tender.awardee} />}
          {tender.award_amount != null && <InfoRow label="Importe adjudicación" value={formatCurrency(tender.award_amount)} />}
          {tender.award_date && <InfoRow label="Fecha adjudicación" value={formatDate(tender.award_date)} />}
          {tender.num_bidders && <InfoRow label="Nº licitadores" value={tender.num_bidders} />}
          {tender.cpv_codes && tender.cpv_codes.length > 0 && (
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-slate-500 mb-1">Códigos CPV</dt>
              <dd className="flex flex-wrap gap-1">
                {tender.cpv_codes.map(c => (
                  <span key={c} className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{c}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Detail section */}
      {hasDetail ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Detalle</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoRow label="Procedimiento" value={tender.procedure_type} />
            <InfoRow label="Tramitación" value={tender.processing_type} />
            <InfoRow label="Sistema de contratación" value={tender.contracting_system} />
            <InfoRow label="Presentación de oferta" value={tender.submission_method} />
            <InfoRow label="Lugar de ejecución" value={tender.execution_location} />
            <InfoRow label="Financiación UE" value={tender.eu_financing} />
          </dl>

          {tender.publications && tender.publications.length > 0 && (
            <div>
              <h3 className="text-xs text-slate-500 mb-2">Publicaciones</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left py-1 font-normal">Fecha</th>
                    <th className="text-left py-1 font-normal">Tipo</th>
                    <th className="text-left py-1 font-normal">Medio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tender.publications.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-1.5 text-slate-700">{p.type}</td>
                      <td className="py-1.5 text-slate-500">{p.medium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 border-dashed p-6 text-center">
          <p className="text-sm text-slate-500 mb-3">El detalle completo de esta licitación no ha sido descargado.</p>
          <ActionButton
            label="Solicitar detalle"
            url={`/api/tenders/detail?slug=${slug}`}
            className="bg-blue-600 text-white hover:bg-blue-700"
          />
        </div>
      )}

      {/* Documents */}
      {(tender.documents?.length || tender.sealedDocuments?.length) ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
          {tender.documents && tender.documents.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Documentos</h2>
              <ul className="space-y-2">
                {tender.documents.map((doc, i) => (
                  <li key={i}>
                    <p className="text-xs text-slate-500 mb-1">{doc.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {doc.links.map((link, j) => (
                        <a key={j} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">
                          {link.format || 'Enlace'}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tender.sealedDocuments && tender.sealedDocuments.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Pliegos</h2>
              <ul className="space-y-1.5">
                {tender.sealedDocuments.map((doc, i) => (
                  <li key={i}>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                      {doc.title || `Pliego ${i + 1}`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Analysis section */}
      {hasAnalysis && tender.analysis ? (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Análisis</h2>
          <AnalysisView analysis={tender.analysis} />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 border-dashed p-6 text-center">
          <p className="text-sm text-slate-500 mb-3">No hay análisis disponible para esta licitación.</p>
          <ActionButton
            label="Solicitar análisis"
            url={`/api/tenders/analyze?slug=${slug}`}
            className="bg-violet-600 text-white hover:bg-violet-700"
          />
        </div>
      )}
    </div>
  )
}
