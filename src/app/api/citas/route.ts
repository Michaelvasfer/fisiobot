// GET /api/citas — todas las citas registradas por el bot.
import { NextResponse } from 'next/server'
import { botPaths, leerJson } from '@/lib/bot-data'
import type { Cita } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const citas = leerJson<Cita[]>(botPaths.citas, [])
  return NextResponse.json(citas)
}
