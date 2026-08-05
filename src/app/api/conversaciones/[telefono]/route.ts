// GET /api/conversaciones/[telefono] — conversación completa con historial.
import { NextResponse } from 'next/server'
import { botPaths, leerJson } from '@/lib/bot-data'
import type { Mensaje } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ConversacionCruda {
  historial?: Mensaje[]
  estado?: string
  handoff?: boolean
  campania?: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ telefono: string }> }
) {
  const { telefono } = await params
  const todas = leerJson<Record<string, ConversacionCruda>>(botPaths.conversaciones, {})
  const leads = leerJson<Record<string, { nombre?: string; nivel_interes?: string; motivo?: string }>>(botPaths.leads, {})
  const citas = leerJson<Array<{ telefono: string; estado: string }>>(botPaths.citas, [])

  const conv = todas[telefono]
  if (!conv) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }

  const historial = conv.historial || []
  const ultimo = historial[historial.length - 1] || null
  return NextResponse.json({
    telefono,
    nombre: (leads[telefono] && leads[telefono].nombre) || null,
    interes: (leads[telefono] && leads[telefono].nivel_interes) || null,
    motivo: (leads[telefono] && leads[telefono].motivo) || null,
    citaPendiente: citas.some((c) => c.telefono === telefono && c.estado === 'PENDIENTE_CONFIRMACION'),
    citaConfirmada: citas.some((c) => c.telefono === telefono && c.estado === 'CONFIRMADA'),
    estado: conv.estado || 'NUEVO',
    handoff: Boolean(conv.handoff),
    campania: conv.campania || null,
    totalMensajes: historial.length,
    ultimoMensaje: ultimo ? ultimo.content.slice(0, 120) : '',
    ultimoRol: ultimo ? ultimo.role : null,
    ultimaActividad: ultimo && ultimo.ts ? ultimo.ts : null,
    historial,
  })
}
