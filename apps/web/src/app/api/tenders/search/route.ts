import { NextResponse } from 'next/server'
import { listTenders } from '@/lib/api'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  try {
    const data = await listTenders(page, 20, q)
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ detail: msg }, { status: 500 })
  }
}
