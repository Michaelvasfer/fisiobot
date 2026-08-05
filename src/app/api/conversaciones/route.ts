// GET /api/conversaciones — lista resumida de conversaciones del bot.
// Réplica exacta de listarConversaciones() de bot/src/store.js.
import { NextResponse } from 'next/server'
import { botPaths, leerJson } from '@/lib/bot-data'
import type { Conversacion, Mensaje } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ConversacionCruda {
  historial?: Mensaje[]
  estado?: string
  handoff?: boolean
  campania?: string | null
}

export function listarConversaciones(): Conversacion[] {
  const todas = leerJson<Record<string, ConversacionCruda>>(botPaths.conversaciones, {})
  const leads = leerJson<Record<string, { nombre?: string; nivel_interes?: string; motivo?: string }>>(botPaths.leads, {})
  const citas = leerJson<Array<{ telefono: string; estado: string }>>(botPaths.citas, [])
  return Object.entries(todas)
    .map(([telefono, conv]) => {
      const historial = conv.historial || []
      const ultimo = historial[historial.length - 1] || null
      return {
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
      }
    })
    .sort((a, b) => (b.ultimaActividad || '').localeCompare(a.ultimaActividad || ''))
}

export async function GET() {
  return NextResponse.json(listarConversaciones())
}
