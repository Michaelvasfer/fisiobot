'use client'
import { authFetch } from '@/lib/auth'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Circle,
  Filter, RefreshCw, FileText, ShieldCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Cita {
  id: string
  estado: string
  creadaEn: string
  telefono: string
  nombre: string
  dni?: string
  edad?: string
  motivo?: string
  fecha: string
  hora: string
  tipoAtencion?: string
  campania?: string
  precio?: string
}

const estadoCitaConfig: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  PENDIENTE_CONFIRMACION: { icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', label: 'Pendiente', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  CONFIRMADA: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Confirmada', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
  CANCELADA: { icon: XCircle, color: 'text-rose-600 dark:text-rose-400', label: 'Cancelada', bg: 'bg-rose-50 dark:bg-rose-950/20' },
  COMPLETADA: { icon: Circle, color: 'text-teal-600 dark:text-teal-400', label: 'Completada', bg: 'bg-teal-50 dark:bg-teal-950/20' },
}

const estados = ['todas', 'PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA']

export function AppointmentsView() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('todas')
  const [search, setSearch] = useState('')

  const fetchCitas = useCallback(async () => {
    try {
      const r = await authFetch('/api/bot/citas')
      if (r.ok) {
        const data = await r.json()
        setCitas(Array.isArray(data) ? data : [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCitas() }, [fetchCitas])

  const handleConfirmar = async (cita: Cita) => {
    setConfirming(cita.id)
    try {
      const r = await authFetch('/api/bot/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: cita.telefono }),
      })
      if (r.ok) {
        toast.success(`Cita de ${cita.nombre} confirmada y notificada por WhatsApp`)
        fetchCitas()
      } else {
        const err = await r.json().catch(() => ({ error: 'Error' }))
        toast.error(err.error || 'Error al confirmar')
      }
    } catch {
      toast.error('Error de conexión')
    }
    setConfirming(null)
  }

  const filtered = citas.filter(c => {
    const matchFiltro = filtro === 'todas' || c.estado === filtro
    const matchSearch = !search ||
      (c.nombre && c.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (c.dni && c.dni.includes(search)) ||
      c.telefono.includes(search)
    return matchFiltro && matchSearch
  })

  const pendientesCount = citas.filter(c => c.estado === 'PENDIENTE_CONFIRMACION').length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total citas', value: citas.length, color: 'text-foreground' },
          { label: 'Pendientes', value: pendientesCount, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Confirmadas', value: citas.filter(c => c.estado === 'CONFIRMADA').length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Campañas', value: citas.filter(c => c.tipoAtencion === 'CAMPAÑA_MEDICA').length, color: 'text-violet-600 dark:text-violet-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Historial de Citas</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Buscar nombre, DNI, teléfono..."
                  className="h-8 w-48 rounded-lg text-[11px] pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { fetchCitas(); toast.info('Actualizando...') }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {estados.map(est => {
              const conf = estadoCitaConfig[est]
              const label = est === 'todas' ? 'Todas' : conf?.label || est
              const isActive = filtro === est
              return (
                <button key={est} onClick={() => setFiltro(est)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                    isActive ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/20' : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >{label}</button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4">Paciente</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4 hidden sm:table-cell">DNI</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4">Fecha</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4 hidden md:table-cell">Hora</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4">Estado</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3 pr-4 hidden lg:table-cell">Tipo</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((cita, i) => {
                    const conf = estadoCitaConfig[cita.estado]
                    const Icon = conf?.icon || Circle
                    return (
                      <motion.tr key={cita.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                              {(cita.nombre || '??').split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium truncate">{cita.nombre}</p>
                              <p className="text-[11px] text-muted-foreground">{cita.telefono}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell">
                          <span className="text-[12px] font-mono text-muted-foreground">{cita.dni || '—'}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-[12px] font-medium">{cita.fecha}</span>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell">
                          <span className="text-[12px] text-muted-foreground">{cita.hora}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 ${conf?.bg} ${conf?.color}`}>
                            <Icon className="h-3 w-3" />{conf?.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <span className="text-[11px] text-muted-foreground">
                            {cita.tipoAtencion === 'CAMPAÑA_MEDICA' ? (cita.campania || 'Campaña') : 'Consulta'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {cita.estado === 'PENDIENTE_CONFIRMACION' ? (
                            <Button size="sm" className="h-7 text-[11px] rounded-lg gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                              disabled={confirming === cita.id} onClick={() => handleConfirmar(cita)}>
                              <ShieldCheck className="h-3 w-3" />
                              {confirming === cita.id ? '...' : 'Confirmar'}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/50">—</span>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No se encontraron citas</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
