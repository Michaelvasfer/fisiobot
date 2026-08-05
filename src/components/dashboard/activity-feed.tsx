'use client'

import { Activity, CalendarCheck, MessageSquare, UserCheck, Star, XCircle, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiData } from '@/lib/api'
import { useDashboardStore, type Vista } from '@/store/dashboard-store'
import type { ActividadItem, DashboardStats } from '@/lib/types'

const iconos: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'calendar-check': { icon: CalendarCheck, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/30' },
  'message-square': { icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  'user-check': { icon: UserCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  star: { icon: Star, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  'x-circle': { icon: XCircle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  'user-plus': { icon: UserPlus, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
}

// Vista a la que lleva cada tipo de evento cuando no hay conversación que abrir.
const vistaPorTipo: Record<ActividadItem['tipo'], Vista> = {
  cita: 'citas',
  cancelacion: 'citas',
  mensaje: 'conversaciones',
  handoff: 'conversaciones',
  lead: 'leads',
}

export function ActivityFeed() {
  const { data: stats, loading } = useApiData<DashboardStats>('/api/stats')
  const { setVista, setConversacionSeleccionada } = useDashboardStore()
  const actividad = stats?.actividadReciente || []

  // Clic en un evento: abre la conversación del paciente (la fuente del dato);
  // si no hay teléfono, lleva a la vista correspondiente.
  const irALaFuente = (item: ActividadItem) => {
    if (item.telefono) {
      setConversacionSeleccionada(item.telefono)
      setVista('conversaciones')
    } else {
      setVista(vistaPorTipo[item.tipo] || 'conversaciones')
    }
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-muted border-t-teal-500 animate-spin" />
          </div>
        ) : actividad.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Sin actividad</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Los eventos aparecerán aquí cuando el agente esté activo</p>
          </div>
        ) : (
          <div className="space-y-1">
            {actividad.map((item, i) => {
              const conf = iconos[item.icono] || iconos['message-square']
              const Icon = conf.icon
              return (
                <button
                  key={i}
                  onClick={() => irALaFuente(item)}
                  title="Ver la conversación de origen"
                  className="w-full text-left flex items-start gap-3 rounded-xl p-2 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${conf.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${conf.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-snug">{item.mensaje}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.tiempo}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
