'use client'

import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useApiData } from '@/lib/api'
import type { ClinicaConfig, Conversacion, DashboardStats, Lead } from '@/lib/types'

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

export function DashboardCharts() {
  const { data: stats, loading } = useApiData<DashboardStats>('/api/stats')
  const { data: conversaciones } = useApiData<Conversacion[]>('/api/conversaciones')
  const { data: leads } = useApiData<Lead[]>('/api/leads')
  const { data: config } = useApiData<ClinicaConfig>('/api/config')

  const serie = stats?.conversacionesPorDia || []
  const haySerie = serie.some((d) => d.total > 0 || d.citas > 0)
  const estados = (stats?.citasPorEstado || []).filter((e) => e.valor > 0)
  const motivos = stats?.motivosFrecuentes || []

  const handoffsActivos = (conversaciones || []).filter((c) => c.handoff).length
  const leadsAlto = (leads || []).filter((l) => l.nivel_interes === 'ALTO').length
  const citasSinConfirmar = (stats?.citasPorEstado || []).find((e) => e.nombre === 'Pendientes')?.valor ?? 0
  const campaniaActiva = (config?.campaniasActivas || []).find((c) => c.estado === 'ACTIVA')?.nombre || 'Ninguna'
  const cuposDisponibles = (config?.cuposDisponibles || []).reduce((acc, d) => acc + d.horas.length, 0)
  const conversacionesSemana = serie.reduce((acc, d) => acc + d.total, 0)

  const resumen = [
    { label: 'Handoffs activos', value: String(handoffsActivos), color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Leads alto interés', value: String(leadsAlto), color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Citas sin confirmar', value: String(citasSinConfirmar), color: 'text-rose-600 dark:text-rose-400' },
    { label: 'Campaña activa', value: campaniaActiva, color: 'text-slate-500' },
    { label: 'Cupos disponibles', value: String(cuposDisponibles), color: 'text-teal-600 dark:text-teal-400' },
    { label: 'Conversaciones semana', value: String(conversacionesSemana), color: 'text-violet-600 dark:text-violet-400' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Conversations over time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="lg:col-span-2"
      >
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Conversaciones por Día</CardTitle>
                <CardDescription className="text-[11px] mt-0.5">Últimos 7 días</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[280px]">
              {loading && !stats ? (
                <LoadingChart />
              ) : !haySerie ? (
                <EmptyChart title="Sin datos aún" description="Los datos aparecerán cuando el agente empiece a recibir conversaciones" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                    />
                    <Area type="monotone" dataKey="total" name="Conversaciones" stroke="#0d9488" strokeWidth={2} fill="url(#gradConv)" />
                    <Area type="monotone" dataKey="citas" name="Citas" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
                    <Area type="monotone" dataKey="confirmadas" name="Confirmadas" stroke="#22c55e" strokeWidth={2} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pie Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Card className="border-border/50 shadow-sm h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Estado de Citas</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">Distribución total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[200px]">
              {loading && !stats ? (
                <LoadingChart />
              ) : estados.length === 0 ? (
                <EmptyChart title="Sin datos" description="Las citas aparecerán aquí" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={estados}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {estados.map((e) => (
                        <Cell key={e.nombre} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {estados.length > 0 && (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                {estados.map((e) => (
                  <span key={e.nombre} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.nombre} ({e.valor})
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="lg:col-span-2"
      >
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Motivos de Consulta Más Frecuentes</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">Según leads y citas registradas</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[220px]">
              {loading && !stats ? (
                <LoadingChart />
              ) : motivos.length === 0 ? (
                <EmptyChart title="Sin datos aún" description="Los motivos se mostrarán cuando haya conversaciones" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivos} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      width={130}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                      formatter={(value) => [value, 'Cantidad']}
                    />
                    <Bar dataKey="cantidad" fill="#0d9488" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card className="border-border/50 shadow-sm h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resumen Rápido</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">Indicadores clave del día</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {resumen.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
