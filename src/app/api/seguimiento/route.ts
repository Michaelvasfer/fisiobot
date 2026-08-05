// GET /api/seguimiento — configuración del seguimiento automático (bot/config/seguimiento.json)
// PUT /api/seguimiento — reemplaza la configuración (el bot la relee en cada ciclo).
import { NextResponse } from 'next/server'
import { botPaths, escribirJson, leerJson } from '@/lib/bot-data'

export const dynamic = 'force-dynamic'

// Valores por defecto si el archivo aún no existe.
const DEFAULTS = {
  activo: false,
  pasos: [],
  maxReintentos: 3,
  pausaNocturna: true,
  horaInicio: '08:00',
  horaFin: '22:00',
}

export async function GET() {
  const config = leerJson(botPaths.seguimientoConfig, DEFAULTS)
  return NextResponse.json(config)
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'La configuración debe ser un objeto JSON' }, { status: 400 })
  }
  const cfg = body as { pasos?: unknown }
  if (!Array.isArray(cfg.pasos)) {
    return NextResponse.json({ error: 'La configuración debe incluir pasos (lista)' }, { status: 400 })
  }
  try {
    escribirJson(botPaths.seguimientoConfig, body)
    return NextResponse.json(body)
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la configuración de seguimiento' }, { status: 500 })
  }
}
