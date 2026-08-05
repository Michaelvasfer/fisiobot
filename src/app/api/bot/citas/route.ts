import { NextResponse } from 'next/server'
import { botFetch } from '@/lib/bot-api'

export async function GET() {
  try {
    const r = await botFetch('/citas')
    if (!r.ok) return NextResponse.json({ error: r.statusText }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  try {
    const r = await botFetch('/citas/confirmar', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }))
      return NextResponse.json(err, { status: r.status })
    }
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}
