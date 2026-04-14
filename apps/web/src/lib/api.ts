import type { Tender, TenderList } from './types'

const API_BASE = process.env.SCRAPER_API_URL
const API_TOKEN = process.env.SCRAPER_API_TOKEN

if (!API_BASE) throw new Error('SCRAPER_API_URL is not set')
if (!API_TOKEN) throw new Error('SCRAPER_API_TOKEN is not set')

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function listTenders(page = 1, limit = 20, q = '') {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  return apiFetch<TenderList>(`/tenders?${params}`)
}

export function getTender(slug: string) {
  return apiFetch<Tender>(`/tenders/${slug}`)
}

export function triggerDetail(slug: string) {
  return apiFetch<{ jobId: string; status: string }>(`/tenders/${slug}/detail`, { method: 'POST' })
}

export function triggerAnalyze(slug: string) {
  return apiFetch<{ jobId: string; status: string }>(`/tenders/${slug}/analyze`, { method: 'POST' })
}
