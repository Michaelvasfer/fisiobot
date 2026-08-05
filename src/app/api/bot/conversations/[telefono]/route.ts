import { NextResponse } from 'next/server'
import { botFetch } from '@/lib/bot-api'

export async function GET(_req: Request, { params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params
  try {
    const r = await botFetch(`/conversaciones/${telefono}`)
    if (!r.ok) return NextResponse.json({ error: r.statusText }, { status: r.status })
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json({ error: 'No se puede conectar al bot' }, { status: 502 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params
  const body = await req.json()
  const subPath = body._action === 'handoff' ? '/handoff' : '/mensaje'
  try {
    const r = await botFetch(`/conversaciones/${telefono}${subPath}`, {
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
