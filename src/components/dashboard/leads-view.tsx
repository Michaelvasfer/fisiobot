'use client'
import { authFetch } from '@/lib/auth'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, TrendingDown, Star, Phone, FileText, RefreshCw, UserCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Lead {
  telefono: string
  nombre?: string
  dni?: string
  motivo?: string
  nivel_interes?: string
  ciudad?: string
  campania?: string
  resumen?: string
  actualizadoEn?: string
}

const interesStyle: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  INTERES_ALTO: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', icon: TrendingUp, label: 'Alto interés' },
  INTERES_MEDIO: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', icon: Star, label: 'Interés medio' },
  INTERES_BAJO: { color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/20', icon: TrendingDown, label: 'Bajo interés' },
  CASO_RECONSTRUCTIVO: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/20', icon: Star, label: 'Reconstructivo' },
  PACIENTE_OPERADO: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/20', icon: Star, label: 'Operado' },
}

export function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchLeads = useCallback(async () => {
    try {
      const r = await authFetch('/api/bot/leads')
      if (r.ok) {
        const data = await r.json()
        setLeads(Array.isArray(data) ? data : [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = leads.filter(l => {
    return !search ||
      (l.nombre && l.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (l.dni && l.dni.includes(search)) ||
      (l.motivo && l.motivo.toLowerCase().includes(search.toLowerCase())) ||
      l.telefono.includes(search)
  })

  const counts = {
    alto: leads.filter(l => l.nivel_interes === 'INTERES_ALTO').length,
    medio: leads.filter(l => l.nivel_interes === 'INTERES_MEDIO').length,
    bajo: leads.filter(l => l.nivel_interes === 'INTERES_BAJO').length,
    otros: leads.filter(l => l.nivel_interes && !['INTERES_ALTO', 'INTERES_MEDIO', 'INTERES_BAJO'].includes(l.nivel_interes)).length,
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total leads', value: leads.length, icon: Users, color: 'text-foreground' },
          { label: 'Interés alto', value: counts.alto, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Interés medio', value: counts.medio, icon: Star, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Otros', value: counts.otros, icon: Users, color: 'text-muted-foreground' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <s.icon className={`h-4 w-4 ${s.color} opacity-50`} />
                </div>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Leads list */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Leads registrados</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input placeholder="Buscar lead..." className="h-8 w-48 rounded-lg text-[11px] pl-8"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={fetchLeads}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UserCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Sin leads registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((lead, i) => {
                const style = interesStyle[lead.nivel_interes || '']
                const Icon = style?.icon || Star
                return (
                  <motion.div
                    key={lead.telefono}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 p-3 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                      {(lead.nombre || lead.telefono).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate">{lead.nombre || 'Sin nombre'}</span>
                        {style && (
                          <Badge variant="secondary" className={`text-[9px] gap-0.5 ${style.bg} ${style.color}`}>
                            <Icon className="h-2.5 w-2.5" />{style.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {lead.motivo && <span className="truncate max-w-[200px]">{lead.motivo}</span>}
                        {lead.ciudad && <span>📍 {lead.ciudad}</span>}
                        {lead.campania && <span className="text-violet-500">📢 {lead.campania}</span>}
                      </div>
                      {lead.resumen && (
                        <p className="text-[11px] text-muted-foreground/60 mt-1 truncate">{lead.resumen}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3" />{lead.telefono}
                      </div>
                      {lead.dni && <span className="text-[10px] font-mono text-muted-foreground/50">DNI: {lead.dni}</span>}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
