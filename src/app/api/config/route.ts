// GET /api/config — contenido de bot/config/clinica.json
// PUT /api/config — reemplaza bot/config/clinica.json (escritura atómica).
// El bot recarga el archivo en caliente (fs.watchFile en bot/src/config.js).
import { NextResponse } from 'next/server'
import { botPaths, escribirJson, leerJson } from '@/lib/bot-data'
import type { ClinicaConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = leerJson<ClinicaConfig | null>(botPaths.clinicaConfig, null)
  if (!config) {
    return NextResponse.json({ error: 'No se pudo leer config/clinica.json' }, { status: 404 })
  }
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
  try {
    escribirJson(botPaths.clinicaConfig, body)
    return NextResponse.json(body)
  } catch {
    return NextResponse.json({ error: 'No se pudo escribir config/clinica.json' }, { status: 500 })
  }
}
