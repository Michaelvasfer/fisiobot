// GET /api/stats — KPIs y series calculadas de los datos reales del bot.
// Misma forma que los exports del antiguo mock-data.
import { NextResponse } from 'next/server'
import { botPaths, leerJson } from '@/lib/bot-data'
import { listarConversaciones } from '../conversaciones/route'
import type {
  ActividadItem,
  Cita,
  CitaPorEstado,
  ConversacionDia,
  DashboardStats,
  Lead,
  Mensaje,
  MotivoFrecuente,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Derivacion {
  id: string
  creadaEn: string
  telefono: string
  resumen?: string
  motivo?: string
}

function parseTs(ts?: string | null): number | null {
  if (!ts) return null
  const t = new Date(ts).getTime()
  return isNaN(t) ? null : t
}

function esMismoDia(ts: number, dia: Date): boolean {
  const d = new Date(ts)
  return (
    d.getFullYear() === dia.getFullYear() &&
    d.getMonth() === dia.getMonth() &&
    d.getDate() === dia.getDate()
  )
}

// Delta porcentual de hoy vs ayer (100 si ayer era 0 y hoy hay algo).
function deltaPct(hoy: number, ayer: number): number {
  if (ayer === 0) return hoy > 0 ? 100 : 0
  return Math.round(((hoy - ayer) / ayer) * 100)
}

// Tiempo relativo en español: "Hace 28 min", "Hace 2 horas", "Hace 1 día".
function tiempoRelativo(ts: number, ahora: number): string {
  const diff = Math.max(0, ahora - ts)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return horas === 1 ? 'Hace 1 hora' : `Hace ${horas} horas`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`
}

// Promedio de respuesta del agente (assistant tras user) en un día dado.
function tiempoRespuestaMs(
  conversaciones: Record<string, { historial?: Mensaje[] }>,
  dia: Date
): number | null {
  const deltas: number[] = []
  for (const conv of Object.values(conversaciones)) {
    const historial = conv.historial || []
    for (let i = 1; i < historial.length; i++) {
      const actual = historial[i]
      const anterior = historial[i - 1]
      if (actual.role !== 'assistant' || anterior.role !== 'user') continue
      const tA = parseTs(anterior.ts)
      const tB = parseTs(actual.ts)
      if (tA === null || tB === null || !esMismoDia(tB, dia)) continue
      const delta = tB - tA
      if (delta >= 0 && delta < 10 * 60 * 1000) deltas.push(delta)
    }
  }
  if (deltas.length === 0) return null
  return deltas.reduce((a, b) => a + b, 0) / deltas.length
}

function formatoTiempo(ms: number | null): string {
  if (ms === null) return '—'
  const seg = Math.round(ms / 1000)
  if (seg < 60) return `${seg}s`
  const min = Math.round(seg / 60)
  if (min < 60) return `${min}m`
  return `${Math.round(min / 60)}h`
}

export async function GET() {
  const ahora = Date.now()
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)

  const conversaciones = listarConversaciones()
  const conversacionesCrudas = leerJson<Record<string, { historial?: Mensaje[] }>>(botPaths.conversaciones, {})
  const citas = leerJson<Cita[]>(botPaths.citas, [])
  const leadsObj = leerJson<Record<string, Omit<Lead, 'telefono'>>>(botPaths.leads, {})
  const leads: Lead[] = Object.entries(leadsObj).map(([telefono, d]) => ({ telefono, ...d }))
  const derivaciones = leerJson<Derivacion[]>(botPaths.derivaciones, [])

  // ---- KPIs ----
  const convHoy = conversaciones.filter((c) => {
    const t = parseTs(c.ultimaActividad)
    return t !== null && esMismoDia(t, hoy)
  }).length
  const convAyer = conversaciones.filter((c) => {
    const t = parseTs(c.ultimaActividad)
    return t !== null && esMismoDia(t, ayer)
  }).length

  const citasHoy = citas.filter((c) => {
    const t = parseTs(c.creadaEn)
    return t !== null && esMismoDia(t, hoy)
  }).length
  const citasAyer = citas.filter((c) => {
    const t = parseTs(c.creadaEn)
    return t !== null && esMismoDia(t, ayer)
  }).length

  const tasaDe = (lista: Cita[]): number | null => {
    if (lista.length === 0) return null
    const ok = lista.filter((c) => c.estado === 'CONFIRMADA' || c.estado === 'COMPLETADA').length
    return Math.round((ok / lista.length) * 100)
  }
  const tasa = tasaDe(citas) ?? 0
  const tasaHoy = tasaDe(citas.filter((c) => {
    const t = parseTs(c.creadaEn)
    return t !== null && esMismoDia(t, hoy)
  }))
  const tasaAyer = tasaDe(citas.filter((c) => {
    const t = parseTs(c.creadaEn)
    return t !== null && esMismoDia(t, ayer)
  }))
  const tasaDelta = tasaHoy !== null && tasaAyer !== null ? tasaHoy - tasaAyer : 0

  const hace7dias = ahora - 7 * 24 * 60 * 60 * 1000
  const leadsActivos = leads.filter((l) => {
    const t = parseTs(l.actualizadoEn)
    return t !== null && t >= hace7dias
  }).length
  const leadsHoy = leads.filter((l) => {
    const t = parseTs(l.actualizadoEn)
    return t !== null && esMismoDia(t, hoy)
  }).length
  const leadsAyer = leads.filter((l) => {
    const t = parseTs(l.actualizadoEn)
    return t !== null && esMismoDia(t, ayer)
  }).length

  const respHoy = tiempoRespuestaMs(conversacionesCrudas, hoy)
  const respAyer = tiempoRespuestaMs(conversacionesCrudas, ayer)
  const respDelta =
    respHoy !== null && respAyer !== null && respAyer > 0
      ? Math.round(((respHoy - respAyer) / respAyer) * 100)
      : 0

  // ---- Serie de los últimos 7 días ----
  const conversacionesPorDia: ConversacionDia[] = []
  for (let i = 6; i >= 0; i--) {
    const dia = new Date()
    dia.setDate(dia.getDate() - i)
    const total = conversaciones.filter((c) => {
      const t = parseTs(c.ultimaActividad)
      return t !== null && esMismoDia(t, dia)
    }).length
    const citasDia = citas.filter((c) => {
      const t = parseTs(c.creadaEn)
      return t !== null && esMismoDia(t, dia)
    })
    conversacionesPorDia.push({
      fecha: `${dia.getDate()} ${MESES_CORTOS[dia.getMonth()]}`,
      total,
      citas: citasDia.length,
      confirmadas: citasDia.filter((c) => c.estado === 'CONFIRMADA' || c.estado === 'COMPLETADA').length,
    })
  }

  // ---- Citas por estado ----
  const contarEstado = (estado: Cita['estado']) => citas.filter((c) => c.estado === estado).length
  const citasPorEstado: CitaPorEstado[] = [
    { nombre: 'Confirmadas', valor: contarEstado('CONFIRMADA'), color: '#0d9488' },
    { nombre: 'Pendientes', valor: contarEstado('PENDIENTE_CONFIRMACION'), color: '#f59e0b' },
    { nombre: 'Completadas', valor: contarEstado('COMPLETADA'), color: '#22c55e' },
    { nombre: 'Canceladas', valor: contarEstado('CANCELADA'), color: '#ef4444' },
  ]

  // ---- Motivos más frecuentes (leads + citas) ----
  const conteoMotivos = new Map<string, number>()
  const sumarMotivo = (motivo?: string | null) => {
    const limpio = (motivo || '').trim()
    if (!limpio) return
    conteoMotivos.set(limpio, (conteoMotivos.get(limpio) || 0) + 1)
  }
  leads.forEach((l) => sumarMotivo(l.motivo))
  citas.forEach((c) => sumarMotivo(c.motivo))
  const totalMotivos = [...conteoMotivos.values()].reduce((a, b) => a + b, 0)
  const motivosFrecuentes: MotivoFrecuente[] = [...conteoMotivos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([motivo, cantidad]) => ({
      motivo,
      cantidad,
      porcentaje: totalMotivos > 0 ? Math.round((cantidad / totalMotivos) * 100) : 0,
    }))

  // ---- Actividad reciente ----
  const nombreDe = (telefono: string) => leadsObj[telefono]?.nombre || telefono
  const eventos: Array<ActividadItem & { ts: number }> = []
  for (const cita of citas) {
    const ts = parseTs(cita.creadaEn)
    if (ts === null) continue
    if (cita.estado === 'CANCELADA') {
      eventos.push({ tipo: 'cancelacion', mensaje: `${cita.nombre} canceló su cita del ${cita.fecha}`, tiempo: '', icono: 'x-circle', ts, telefono: cita.telefono })
    } else if (cita.estado === 'CONFIRMADA') {
      eventos.push({ tipo: 'cita', mensaje: `${cita.nombre} confirmó cita para ${cita.fecha}`, tiempo: '', icono: 'calendar-check', ts, telefono: cita.telefono })
    } else if (cita.estado === 'COMPLETADA') {
      eventos.push({ tipo: 'cita', mensaje: `${cita.nombre} completó su cita del ${cita.fecha}`, tiempo: '', icono: 'calendar-check', ts, telefono: cita.telefono })
    } else {
      eventos.push({ tipo: 'cita', mensaje: `${cita.nombre} solicitó cita para ${cita.fecha}`, tiempo: '', icono: 'calendar-check', ts, telefono: cita.telefono })
    }
  }
  for (const der of derivaciones) {
    const ts = parseTs(der.creadaEn)
    if (ts === null) continue
    eventos.push({ tipo: 'handoff', mensaje: `${nombreDe(der.telefono)} derivado a recepción`, tiempo: '', icono: 'user-check', ts, telefono: der.telefono })
  }
  for (const conv of conversaciones) {
    const ts = parseTs(conv.ultimaActividad)
    if (ts === null) continue
    eventos.push({ tipo: 'mensaje', mensaje: `Nuevo mensaje de ${conv.nombre || conv.telefono}`, tiempo: '', icono: 'message-square', ts, telefono: conv.telefono })
  }
  const actividadReciente: ActividadItem[] = eventos
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ ts, ...ev }) => ({ ...ev, tiempo: tiempoRelativo(ts, ahora) }))

  const stats: DashboardStats = {
    kpis: {
      conversacionesHoy: convHoy,
      conversacionesDelta: deltaPct(convHoy, convAyer),
      citasHoy,
      citasDelta: deltaPct(citasHoy, citasAyer),
      tasaConfirmacion: tasa,
      tasaConfirmacionDelta: tasaDelta,
      leadsActivos,
      leadsDelta: leadsHoy - leadsAyer,
      tiempoRespuesta: formatoTiempo(respHoy),
      tiempoRespuestaDelta: respDelta,
    },
    conversacionesPorDia,
    citasPorEstado,
    motivosFrecuentes,
    actividadReciente,
  }
  return NextResponse.json(stats)
}
