'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useApiData } from '@/lib/api'
import type { Cita, Conversacion, DashboardStats, Lead } from '@/lib/types'

const EmptyChart = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-12">
    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
      <BarChart3 className="h-6 w-6 text-muted-foreground/30" />
    </div>
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    <p className="text-[11px] text-muted-foreground/60 mt-1">{description}</p>
  </div>
)

const LoadingChart = () => (
  <div className="flex items-center justify-center h-full">
    <div className="h-8 w-8 rounded-full border-2 border-muted border-t-teal-500 animate-spin" />
  </div>
)

const funnelColors = ['#0d9488', '#14b8a6', '#2dd4bf', '#f59e0b', '#22c55e', '#10b981']

export function AnalyticsView() {
  const { data: stats, loading } = useApiData<DashboardStats>('/api/stats')
  const { data: conversaciones } = useApiData<Conversacion[]>('/api/conversaciones')
  const { data: citas } = useApiData<Cita[]>('/api/citas')
  const { data: leads } = useApiData<Lead[]>('/api/leads')

  const convs = conversaciones || []
  const listaCitas = citas || []
  const listaLeads = leads || []

  const totalConversaciones = convs.length
  const totalMensajes = convs.reduce((acc, c) => acc + c.totalMensajes, 0)
  const confirmadas = listaCitas.filter((c) => c.estado === 'CONFIRMADA' || c.estado === 'COMPLETADA').length
  const completadas = listaCitas.filter((c) => c.estado === 'COMPLETADA').length
  const conCita = new Set(listaCitas.map((c) => c.telefono)).size
  const intentoCita = convs.filter(
    (c) => c.citaPendiente || c.citaConfirmada || ['TOMANDO_CITA', 'ESPERANDO_CONFIRMACION', 'CITA_CONFIRMADA', 'COMPLETADO'].includes(c.estado)
  ).length
  const handoffs = convs.filter((c) => c.handoff).length
  const tasaConversion = totalConversaciones > 0 ? Math.round((confirmadas / totalConversaciones) * 100) : 0

  const performanceMetrics = [
    { label: 'Conversaciones totales', value: String(totalConversaciones), delta: '—' },
    { label: 'Tasa de conversión', value: `${tasaConversion}%`, delta: '—' },
    { label: 'Tiempo promedio respuesta', value: stats?.kpis.tiempoRespuesta || '—', delta: '—' },
    {
      label: 'Mensajes por conversación',
      value: totalConversaciones > 0 ? (totalMensajes / totalConversaciones).toFixed(1) : '—',
      delta: '—',
    },
    { label: 'Leads registrados', value: String(listaLeads.length), delta: '—' },
    { label: 'Derivaciones a recepción', value: String(handoffs), delta: '—' },
  ]

  // Distribución por hora: actividad de conversaciones + creación de citas.
  const porHora = new Map<number, { conversaciones: number; citas: number }>()
  const sumarHora = (ts: string | null, tipo: 'conversaciones' | 'citas') => {
    if (!ts) return
    const d = new Date(ts)
    if (isNaN(d.getTime())) return
    const h = d.getHours()
    const entry = porHora.get(h) || { conversaciones: 0, citas: 0 }
    entry[tipo]++
    porHora.set(h, entry)
  }
  convs.forEach((c) => sumarHora(c.ultimaActividad, 'conversaciones'))
  listaCitas.forEach((c) => sumarHora(c.creadaEn, 'citas'))
  const distribucionHoras = [...porHora.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, v]) => ({ hora: `${h}:00`, ...v }))

  const actividadSemanal = stats?.conversacionesPorDia || []
  const hayActividadSemanal = actividadSemanal.some((d) => d.total > 0 || d.citas > 0)

  const base = Math.max(totalConversaciones, 1)
  const funnelSteps = [
    { etapa: 'Conversación', valor: totalConversaciones },
    { etapa: 'Calificado', valor: listaLeads.length },
    { etapa: 'Intento cita', valor: intentoCita },
    { etapa: 'Cita agendada', valor: conCita },
    { etapa: 'Confirmada', valor: confirmadas },
    { etapa: 'Completada', valor: completadas },
  ].map((s, i) => ({ ...s, color: funnelColors[i], porcentaje: Math.round((s.valor / base) * 100) }))

  return (
    <div className="space-y-4">
      {/* Performance metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {performanceMetrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{m.label}</p>
                <p className="text-xl font-bold mt-1.5">{m.value}</p>
                <p className="text-[10px] text-muted-foreground/50 font-semibold mt-0.5">{m.delta}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/50 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribución por Hora</CardTitle>
              <CardDescription className="text-[11px]">Conversaciones y citas por franja horaria</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[260px]">
                {loading && !stats ? (
                  <LoadingChart />
                ) : distribucionHoras.length === 0 ? (
                  <EmptyChart title="Sin datos aún" description="Las estadísticas aparecerán cuando el agente esté activo" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribucionHoras} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="hora" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="conversaciones" name="Conversaciones" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="citas" name="Citas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/50 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Actividad Semanal</CardTitle>
              <CardDescription className="text-[11px]">Últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[260px]">
                {loading && !stats ? (
                  <LoadingChart />
                ) : !hayActividadSemanal ? (
                  <EmptyChart title="Sin datos aún" description="La actividad semanal se mostrará aquí" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actividadSemanal} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="total" name="Conversaciones" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="citas" name="Citas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conversion funnel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/50 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Embudo de Conversión</CardTitle>
              <CardDescription className="text-[11px]">De conversación a cita completada</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {totalConversaciones === 0 ? (
                <div className="h-[240px]">
                  <EmptyChart title="Sin datos aún" description="El embudo se calculará cuando haya conversaciones" />
                </div>
              ) : (
              <div className="space-y-2.5">
                {funnelSteps.map((step) => (
                  <div key={step.etapa} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium">{step.etapa}</span>
                      <span className="font-bold text-muted-foreground">{step.valor} · {step.porcentaje}%</span>
                    </div>
                    <div className="h-6 rounded-lg bg-muted/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(step.porcentaje, step.valor > 0 ? 4 : 0)}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: step.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent performance radar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="border-border/50 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Rendimiento del Agente</CardTitle>
              <CardDescription className="text-[11px]">Métricas cualitativas estimadas</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[280px]">
                <EmptyChart title="Sin datos" description="Las métricas del agente aparecerán con uso" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
