// POST /api/push/desuscribir — elimina la suscripción push de este dispositivo.
import { NextResponse } from 'next/server'
import { botFetch } from '@/lib/bot-api'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const r = await botFetch('/push/desuscribir', { method: 'POST', body: JSON.stringify(body) })
    if (!r.ok) return NextResponse.json({ error: r.statusText }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}
