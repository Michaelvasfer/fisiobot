// GET /api/leads — leads del bot como array (el bot los guarda como
// objeto indexado por teléfono).
import { NextResponse } from 'next/server'
import { botPaths, leerJson } from '@/lib/bot-data'
import type { Lead } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const leads = leerJson<Record<string, Omit<Lead, 'telefono'>>>(botPaths.leads, {})
  const lista: Lead[] = Object.entries(leads)
    .map(([telefono, datos]) => ({ telefono, ...datos }))
    .sort((a, b) => (b.actualizadoEn || '').localeCompare(a.actualizadoEn || ''))
  return NextResponse.json(lista)
}
