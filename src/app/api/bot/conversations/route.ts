import { NextResponse } from 'next/server'
import { botFetch } from '@/lib/bot-api'

export async function GET() {
  try {
    const r = await botFetch('/conversaciones')
    if (!r.ok) return NextResponse.json({ error: r.statusText }, { status: r.status })
    const data = await r.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}
