'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, CalendarDays, Trash2, Zap, CalendarRange,
  ChevronDown, ChevronUp, Sparkles, Sun, Sunset, Moon, Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { fetchApi } from '@/lib/api'
import type { ClinicaConfig, CupoDia } from '@/lib/types'

// ── Generate all 30-min slots from 8:00 AM to 10:00 PM ──
const ALL_SLOTS: string[] = []
for (let h = 8; h <= 22; h++) {
  if (h === 22) {
    ALL_SLOTS.push(formatHora(h, 0))
  } else {
    ALL_SLOTS.push(formatHora(h, 0))
    ALL_SLOTS.push(formatHora(h, 30))
  }
}

function formatHora(h24: number, min: number): string {
  const period = h24 >= 12 && h24 < 24 ? 'p. m.' : 'a. m.'
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24
  return `${h12}:${min === 0 ? '00' : '30'} ${period}`
}

// Group slots into time blocks for the grid
interface TimeBlock {
  hour24: number
  label: string
  slots: { min: number; label: string; full: string }[]
}

function buildTimeGrid(): TimeBlock[] {
  const blocks: TimeBlock[] = []
  for (let h = 8; h <= 22; h++) {
    const period = h >= 12 && h < 24 ? 'p. m.' : 'a. m.'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    const slots: TimeBlock['slots'] = []
    slots.push({ min: 0, label: ':00', full: `${h12}:00 ${period}` })
    if (h < 22) {
      slots.push({ min: 30, label: ':30', full: `${h12}:30 ${period}` })
    }
    blocks.push({
      hour24: h,
      label: `${h12}:00 ${period}`,
      slots,
    })
  }
  return blocks
}

const TIME_GRID = buildTimeGrid()

const SECTIONS = [
  { label: 'Mañana', icon: Sun, range: [8, 13], color: 'text-amber-600 dark:text-amber-400' },
  { label: 'Tarde', icon: Sunset, range: [14, 19], color: 'text-orange-600 dark:text-orange-400' },
  { label: 'Noche', icon: Moon, range: [20, 22], color: 'text-purple-600 dark:text-purple-400' },
] as const

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fechaEspanol(date: Date): string {
  const diaSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][date.getDay()]
  const dia = date.getDate()
  const mes = MESES[date.getMonth()]
  return `${diaSemana} ${dia} de ${mes}`
}

// ── Visual Grid Component ──
function TimeSlotGrid({
  selected,
  onToggle,
  compact = false,
}: {
  selected: string[]
  onToggle: (slot: string) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-3">
      {SECTIONS.map((section) => {
        const SectionIcon = section.icon
        const sectionBlocks = TIME_GRID.filter(b => b.hour24 >= section.range[0] && b.hour24 <= section.range[1])
        const sectionSelected = sectionBlocks.reduce(
          (acc, b) => acc + b.slots.filter(s => selected.includes(s.full)).length, 0
        )
        const sectionTotal = sectionBlocks.reduce((acc, b) => acc + b.slots.length, 0)

        return (
          <div key={section.label}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <SectionIcon className={`h-3.5 w-3.5 ${section.color}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">
                {sectionSelected}/{sectionTotal}
              </span>
            </div>

            {/* Grid: rows = hours, cols = :00 / :30 */}
            <div className="space-y-1">
              {/* Column headers */}
              <div className="grid gap-1.5" style={{ gridTemplateColumns: compact ? '56px 1fr 1fr' : '80px 1fr 1fr' }}>
                <div />
                <div className="text-center text-[9px] font-semibold text-muted-foreground/50 uppercase">:00</div>
                <div className="text-center text-[9px] font-semibold text-muted-foreground/50 uppercase">:30</div>

                {sectionBlocks.map((block) => (
                  <div key={block.hour24} className="contents">
                    {/* Hour label */}
                    <div className={`flex items-center ${compact ? 'text-[11px]' : 'text-xs'} font-medium text-muted-foreground/80 pr-2`}>
                      {block.label}
                    </div>

                    {/* Slot cells */}
                    {block.slots.map((slot) => {
                      const isActive = selected.includes(slot.full)
                      return (
                        <motion.button
                          key={slot.full}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => onToggle(slot.full)}
                          className={`relative flex items-center justify-center rounded-lg transition-all duration-150 ${
                            compact ? 'h-8' : 'h-9'
                          } ${
                            isActive
                              ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-500/20'
                              : 'bg-muted/60 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground/70'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            >
                              <Check className={`h-3.5 w-3.5 ${compact ? 'h-3 w-3' : ''}`} />
                            </motion.div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main SlotManager ──
export function SlotManager() {
  const [cupos, setCupos] = useState<CupoDia[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [fechaInputDate, setFechaInputDate] = useState('')
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [diaExpandido, setDiaExpandido] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkWeekStart, setBulkWeekStart] = useState('')
  const [editandoFecha, setEditandoFecha] = useState<number | null>(null)
  const [editHoras, setEditHoras] = useState<string[]>([])

  // Carga inicial de cuposDisponibles desde la config real del bot.
  useEffect(() => {
    fetchApi<ClinicaConfig>('/api/config')
      .then((cfg) => setCupos(cfg.cuposDisponibles || []))
      .catch(() => toast.error('No se pudieron cargar los horarios'))
      .finally(() => setCargando(false))
  }, [])

  // Persiste los cupos: lee la config actual, reemplaza cuposDisponibles
  // y la reescribe vía PUT (el bot la recarga en caliente).
  const persistirCupos = useCallback(async (nuevos: CupoDia[]) => {
    try {
      const cfg = await fetchApi<ClinicaConfig>('/api/config')
      await fetchApi('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ ...cfg, cuposDisponibles: nuevos }),
      })
    } catch {
      toast.error('No se pudieron guardar los horarios en el servidor')
    }
  }, [])

  const actualizarCupos = useCallback((nuevos: CupoDia[]) => {
    setCupos(nuevos)
    persistirCupos(nuevos)
  }, [persistirCupos])

  const toggleSlot = useCallback((slot: string) => {
    setSeleccionadas(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot].sort()
    )
  }, [])

  const toggleEditSlot = useCallback((slot: string) => {
    setEditHoras(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot].sort()
    )
  }, [])

  const handleDateInput = (dateStr: string) => {
    setFechaInputDate(dateStr)
    if (!dateStr) { setNuevaFecha(''); return }
    const d = new Date(dateStr + 'T00:00:00')
    if (!isNaN(d.getTime())) setNuevaFecha(fechaEspanol(d))
  }

  const agregarFecha = () => {
    if (!nuevaFecha.trim()) { toast.error('Selecciona una fecha'); return }
    if (seleccionadas.length === 0) { toast.error('Marca al menos una hora en el grid'); return }
    if (cupos.some(c => c.fecha.toLowerCase().trim() === nuevaFecha.toLowerCase().trim())) {
      toast.error('Esa fecha ya existe — edítala expandiéndola')
      return
    }
    actualizarCupos([...cupos, { fecha: nuevaFecha.trim(), horas: [...seleccionadas] }])
    setNuevaFecha(''); setFechaInputDate(''); setSeleccionadas([])
    toast.success(`${nuevaFecha.trim()} — ${seleccionadas.length} cupos agregados`)
  }

  const guardarEdicion = () => {
    if (editandoFecha === null) return
    actualizarCupos(
      cupos.map((d, i) => i === editandoFecha ? { ...d, horas: [...editHoras] } : d)
        .filter(d => d.horas.length > 0)
    )
    setEditandoFecha(null)
    setEditHoras([])
    toast.success('Horarios actualizados')
  }

  const quitarFecha = (idx: number) => {
    const fecha = cupos[idx]?.fecha
    actualizarCupos(cupos.filter((_, i) => i !== idx))
    setDiaExpandido(null); setEditandoFecha(null)
    toast.success(`Eliminado: ${fecha}`)
  }

  const seleccionarRango = (desde: string, hasta: string, tipo: 'add' | 'remove') => {
    const startIdx = ALL_SLOTS.indexOf(desde)
    const endIdx = ALL_SLOTS.indexOf(hasta)
    if (startIdx === -1 || endIdx === -1) return
    const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    const rango = ALL_SLOTS.slice(lo, hi + 1)
    setSeleccionadas(prev => {
      if (tipo === 'add') {
        const merged = new Set([...prev, ...rango])
        return [...merged].sort()
      }
      return prev.filter(s => !rango.includes(s))
    })
  }

  // Bulk generate week
  const generarSemana = () => {
    if (!bulkWeekStart) { toast.error('Selecciona una fecha'); return }
    const start = new Date(bulkWeekStart + 'T00:00:00')
    if (isNaN(start.getTime())) { toast.error('Fecha inválida'); return }
    const day = start.getDay()
    const monday = new Date(start); monday.setDate(start.getDate() + (day === 0 ? -6 : 1 - day))

    const nuevas: CupoDia[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      const label = fechaEspanol(d)
      if (!cupos.some(c => c.fecha.toLowerCase().trim() === label.toLowerCase().trim())) {
        nuevas.push({ fecha: label, horas: [...seleccionadas.length > 0 ? seleccionadas : ALL_SLOTS] })
      }
    }
    if (nuevas.length === 0) { toast.info('Todos los días ya tienen cupos'); return }
    actualizarCupos([...cupos, ...nuevas])
    setDialogOpen(false); setBulkWeekStart('')
    toast.success(`Semana generada: ${nuevas.length} días`)
  }

  const totalSlots = cupos.reduce((acc, d) => acc + d.horas.length, 0)

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
              <CalendarRange className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Gestionar Horarios</CardTitle>
              <CardDescription className="text-[11px]">Marca las horas disponibles con un clic</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
              {cupos.length} días · {totalSlots} cupos
            </Badge>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 h-8">
                  <Zap className="h-3 w-3" /> Semana completa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-sm">Generar semana completa</DialogTitle>
                  <DialogDescription className="text-xs">
                    Crea cupos de lunes a viernes usando las horas que marquemos abajo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha de referencia (se busca el lunes de esa semana)</Label>
                    <Input type="date" value={bulkWeekStart} onChange={(e) => setBulkWeekStart(e.target.value)} className="text-xs h-9 rounded-xl" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSeleccionadas([...ALL_SLOTS])}
                      className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >Marcar todas (8 AM – 10 PM)</button>
                    <span className="text-muted-foreground/30">·</span>
                    <button
                      onClick={() => setSeleccionadas([])}
                      className="text-[10px] text-muted-foreground hover:underline"
                    >Desmarcar todas</button>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto pr-1">
                    <TimeSlotGrid selected={seleccionadas} onToggle={(s) => {
                      setSeleccionadas(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort())
                    }} compact />
                  </div>
                  {bulkWeekStart && !isNaN(new Date(bulkWeekStart + 'T00:00:00').getTime()) && (() => {
                    const s = new Date(bulkWeekStart + 'T00:00:00')
                    const day = s.getDay()
                    const mon = new Date(s); mon.setDate(s.getDate() + (day === 0 ? -6 : 1 - day))
                    return (
                      <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                        <p className="text-[11px] font-medium">Días que se crearán:</p>
                        {DIAS_SEMANA.map((_, i) => {
                          const d = new Date(mon); d.setDate(mon.getDate() + i)
                          const label = fechaEspanol(d)
                          const exists = cupos.some(c => c.fecha.toLowerCase().trim() === label.toLowerCase().trim())
                          return (
                            <p key={i} className={`text-[11px] flex items-center gap-1.5 ${exists ? 'text-muted-foreground line-through' : ''}`}>
                              {exists ? '○' : '●'} {label} — {seleccionadas.length > 0 ? seleccionadas.length : ALL_SLOTS.length} cupos
                            </p>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button size="sm" className="rounded-xl text-xs bg-gradient-to-r from-teal-500 to-teal-600" onClick={generarSemana}>
                    <Sparkles className="h-3 w-3 mr-1" /> Generar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* ── Quick Add: Date + Grid ── */}
        <div className="rounded-2xl border-2 border-dashed border-teal-300/50 dark:border-teal-700/40 bg-teal-500/[0.03] p-4 space-y-3">
          {/* Date row + actions */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">1. Selecciona la fecha</Label>
              <Input
                type="date"
                value={fechaInputDate}
                onChange={(e) => handleDateInput(e.target.value)}
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                className="rounded-xl text-xs h-9 gap-1.5 bg-gradient-to-r from-teal-500 to-teal-600 shrink-0"
                onClick={agregarFecha}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar {seleccionadas.length > 0 ? `(${seleccionadas.length})` : ''}
              </Button>
            </div>
          </div>

          {/* Quick range selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground">2. Marca las horas:</span>
            <button onClick={() => seleccionarRango('8:00 a. m.', '1:30 p. m.', 'add')} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline">Mañana (8–1:30)</button>
            <button onClick={() => seleccionarRango('2:00 p. m.', '7:30 p. m.', 'add')} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline">Tarde (2–7:30)</button>
            <button onClick={() => seleccionarRango('8:00 p. m.', '10:00 p. m.', 'add')} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline">Noche (8–10)</button>
            <button onClick={() => seleccionarRango('8:00 a. m.', '10:00 p. m.', 'add')} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline">Todo el día</button>
            <span className="text-muted-foreground/20">·</span>
            <button onClick={() => setSeleccionadas([])} className="text-[10px] text-muted-foreground hover:underline">Limpiar</button>
          </div>

          {/* The visual grid */}
          <div className="max-h-[340px] overflow-y-auto pr-1">
            <TimeSlotGrid selected={seleccionadas} onToggle={toggleSlot} />
          </div>
        </div>

        {/* ── Existing dates ── */}
        {cargando && (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 rounded-full border-2 border-muted border-t-teal-500 animate-spin" />
          </div>
        )}
        {!cargando && cupos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fechas configuradas</span>
            </div>
            <AnimatePresence>
              {cupos.map((dia, idx) => {
                const expandido = diaExpandido === idx
                const editando = editandoFecha === idx
                return (
                  <motion.div
                    key={`${dia.fecha}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="rounded-xl border border-border/40 bg-card overflow-hidden"
                  >
                    {/* Row header */}
                    <button
                      onClick={() => {
                        if (editando) { guardarEdicion(); return }
                        setDiaExpandido(expandido ? null : idx)
                        if (!expandido) setEditHoras([...dia.horas])
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/20">
                          <CalendarDays className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-[13px] font-semibold capitalize">{dia.fecha}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {dia.horas.length} cupo{dia.horas.length !== 1 ? 's' : ''} · {dia.horas[0]}{dia.horas.length > 1 ? ` – ${dia.horas[dia.horas.length - 1]}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400">
                          {dia.horas.length}
                        </Badge>
                        {expandido ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded: visual grid to edit */}
                    <AnimatePresence>
                      {expandido && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/30 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Editar horarios</p>
                                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">{editHoras.length} marcadas</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => quitarFecha(idx)}
                                  className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 dark:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" /> Eliminar
                                </button>
                              </div>
                            </div>

                            {/* Quick selectors for editing */}
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => setEditHoras([...ALL_SLOTS])} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline">Marcar todo</button>
                              <span className="text-muted-foreground/20">·</span>
                              <button onClick={() => setEditHoras([])} className="text-[10px] text-muted-foreground hover:underline">Limpiar</button>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto pr-1">
                              <TimeSlotGrid selected={editHoras} onToggle={toggleEditSlot} compact />
                            </div>

                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                className="rounded-xl text-[11px] h-8 bg-gradient-to-r from-teal-500 to-teal-600"
                                onClick={() => {
                                  actualizarCupos(
                                    cupos.map((d, i) => i === idx ? { ...d, horas: [...editHoras] } : d)
                                      .filter(d => d.horas.length > 0)
                                  )
                                  setDiaExpandido(null)
                                  toast.success('Horarios guardados')
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" /> Guardar cambios
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {!cargando && cupos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <CalendarDays className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin cupos configurados</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Selecciona una fecha y marca las horas en el grid</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
