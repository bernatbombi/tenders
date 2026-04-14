'use client'

import { useState } from 'react'

interface Props {
  label: string
  url: string
  className?: string
}

export default function ActionButton({ label, url, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setState('loading')
    setError(null)
    try {
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      setJobId(data.jobId)
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block">
        Job started — ID: <span className="font-mono font-medium">{jobId?.slice(0, 8)}…</span>. Refresh the page in a moment.
      </p>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => setState('idle')} className="text-sm text-slate-500 underline">Retry</button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {state === 'loading' ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </>
      ) : label}
    </button>
  )
}
