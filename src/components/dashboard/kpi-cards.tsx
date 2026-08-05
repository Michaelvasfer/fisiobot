'use client'

import { motion } from 'framer-motion'
import {
  MessageSquare,
  CalendarCheck,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Zap,
} from 'lucide-react'
import { useApiData } from '@/lib/api'
import { useDashboardStore, type Vista } from '@/store/dashboard-store'
import type { DashboardStats } from '@/lib/types'

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

const cardBase = [
  {
    key: 'conversaciones',
    label: 'Conversaciones Hoy',
    icon: MessageSquare,
    gradient: 'from-teal-500 to-emerald-500',
    destino: 'conversaciones' as Vista,
  },
  {
    key: 'citas',
    label: 'Citas Agendadas',
    icon: CalendarCheck,
    gradient: 'from-amber-500 to-orange-500',
    destino: 'citas' as Vista,
  },
  {
    key: 'tasa',
    label: 'Tasa Confirmación',
    icon: TrendingUp,
    gradient: 'from-violet-500 to-purple-500',
    destino: 'analiticas' as Vista,
  },
  {
    key: 'tiempo',
    label: 'Tiempo Respuesta',
    icon: Zap,
    gradient: 'from-rose-500 to-pink-500',
    destino: 'analiticas' as Vista,
  },
] as const

export function KpiCards() {
  const { data: stats, loading } = useApiData<DashboardStats>('/api/stats')
  const { setVista } = useDashboardStore()

  const cards = cardBase.map((base) => {
    if (!stats) return { ...base, value: '—', delta: 0, suffix: '', isTime: false }
    const k = stats.kpis
    switch (base.key) {
      case 'conversaciones':
        return { ...base, value: String(k.conversacionesHoy), delta: k.conversacionesDelta, suffix: '', isTime: false }
      case 'citas':
        return { ...base, value: String(k.citasHoy), delta: k.citasDelta, suffix: '', isTime: false }
      case 'tasa':
        return { ...base, value: String(k.tasaConfirmacion), delta: k.tasaConfirmacionDelta, suffix: '%', isTime: false }
      case 'tiempo':
        return { ...base, value: k.tiempoRespuesta, delta: k.tiempoRespuestaDelta, suffix: '', isTime: true }
    }
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        const isPositive = card.delta >= 0
        // For time, lower is better
        const showGreen = card.isTime ? !isPositive : isPositive
        const DeltaIcon = card.delta < 0 ? ArrowDownRight : ArrowUpRight

        return (
          <motion.div
            key={card.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            onClick={() => setVista(card.destino)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVista(card.destino) }}
            title={`Ir a ${card.destino}`}
            className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm hover:shadow-md hover:border-teal-300/60 dark:hover:border-teal-700/50 transition-all duration-300 cursor-pointer`}
          >
            {/* Background gradient accent */}
            <div className={`absolute top-0 right-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-500`} />

            <div className="relative flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                  {card.label}
                </p>
                <div className="flex items-baseline gap-1.5">
                  {loading && !stats ? (
                    <span className="inline-block h-8 w-16 rounded-lg bg-muted animate-pulse" />
                  ) : (
                    <span className="text-3xl font-bold tracking-tight">
                      {card.value}{card.suffix}
                    </span>
                  )}
                </div>
                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  showGreen
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                }`}>
                  <DeltaIcon className="h-3 w-3" />
                  {Math.abs(card.delta)}%
                  <span className="font-normal opacity-70">vs ayer</span>
                </div>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg shadow-black/5`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
