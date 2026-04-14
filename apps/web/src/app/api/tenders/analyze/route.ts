import { NextResponse } from 'next/server'
import { triggerAnalyze } from '@/lib/api'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ detail: 'Missing slug' }, { status: 400 })
  try {
    const data = await triggerAnalyze(slug)
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ detail: msg }, { status: 500 })
  }
}
