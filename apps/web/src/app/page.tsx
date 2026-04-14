import Link from 'next/link'
import { listTenders } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/format'
import type { TenderSummary } from '@/lib/types'
import SearchBar from '@/components/SearchBar'

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>
}

function RecBadge({ rec }: { rec?: 'GREEN' | 'AMBER' | 'RED' }) {
  if (!rec) return null
  const cls = { GREEN: 'bg-green-100 text-green-700', AMBER: 'bg-amber-100 text-amber-700', RED: 'bg-red-100 text-red-700' }[rec]
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{rec}</span>
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
}

export default async function HomePage({ searchParams }: PageProps) {
  const { page: pageParam, q = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  let data
  try {
    data = await listTenders(page, 20, q)
  } catch (e) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
        Failed to load tenders: {e instanceof Error ? e.message : 'Unknown error'}
      </div>
    )
  }

  const { items, total, pages } = data

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Licitaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {q ? `${total} resultado${total !== 1 ? 's' : ''} para "${q}"` : `${total} ofertas activas`}
          </p>
        </div>
      </div>
      <div className="mb-6">
        <SearchBar defaultValue={q} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Expediente</th>
              <th className="text-left px-4 py-3 font-medium">Descripción</th>
              <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Presupuesto</th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Plazo</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">No hay licitaciones</td>
              </tr>
            )}
            {items.map((t: TenderSummary) => (
              <tr key={t.expediente} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 align-top">
                  <Link href={`/tenders/${t.slug}`} className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline">
                    {t.expediente}
                  </Link>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {t.procedure_type && <Badge label="Detail" color="bg-blue-100 text-blue-700" />}
                    {t.analysis && <RecBadge rec={t.analysis.summary?.recommendation} />}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <Link href={`/tenders/${t.slug}`} className="text-slate-800 hover:text-slate-600 leading-snug">
                    {t.description || '—'}
                  </Link>
                  <p className="text-xs text-slate-400 mt-0.5">{t.contracting_authority}{t.contract_type ? ` · ${t.contract_type}` : ''}</p>
                </td>
                <td className="px-4 py-3 align-top text-right hidden lg:table-cell">
                  <p className="text-slate-900 font-medium tabular-nums">{formatCurrency(t.budget)}</p>
                </td>
                <td className="px-4 py-3 align-top text-right hidden sm:table-cell">
                  <p className="text-slate-600 tabular-nums text-xs">{formatDate(t.submission_deadline)}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-xs text-slate-500">{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">Página {page} de {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
                ← Anterior
              </Link>
            )}
            {page < pages && (
              <Link href={`/?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
