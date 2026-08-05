import { NextResponse } from 'next/server'
import { botFetch } from '@/lib/bot-api'

export async function GET() {
  try {
    const r = await botFetch('/leads')
    if (!r.ok) return NextResponse.json({ error: r.statusText }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}
