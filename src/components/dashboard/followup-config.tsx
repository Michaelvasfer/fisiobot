'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Plus, Trash2, Timer, MessageSquare,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Eye, Send, Clock, AlertCircle, Save,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { fetchApi, useApiData } from '@/lib/api'

// ── Types ──
interface FollowUpStep {
  id: string
  activo: boolean
  delay: number        // minutes
  delayLabel: string   // human-readable
  mensaje: string
}

interface FollowUpConfig {
  activo: boolean
  pasos: FollowUpStep[]
  maxReintentos: number
  pausaNocturna: boolean
  horaInicio: string
  horaFin: string
}

// ── Delay presets ──
const DELAY_PRESETS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 360, label: '6 horas' },
  { value: 480, label: '8 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '1 día' },
  { value: 2880, label: '2 días' },
  { value: 4320, label: '3 días' },
  { value: 10080, label: '7 días' },
]

function getDelayPreset(minutes: number) {
  return DELAY_PRESETS.find(p => p.value === minutes) || { value: minutes, label: `${minutes} min` }
}

// ── Default messages per step ──
const DEFAULT_MESSAGES: Record<number, string> = {
  1: '¿Sigue ahí? 😊 Si necesita ayuda para agendar su cita, estoy aquí para asistirle.',
  2: 'Hola de nuevo 🙋 Recuerdo que estábamos conversando sobre su cita. ¿Le gustaría continuar?',
  3: 'No quiero molestarle, solo quería recordarle que puede agendar su cita cuando lo desee. ¡Estaré aquí! 🏥',
}

// ── Conversation Preview ──
function ConversationPreview({ pasos, nombre }: { pasos: FollowUpStep[]; nombre: string }) {
  const pasosActivos = pasos.filter(p => p.activo)
  if (pasosActivos.length === 0) return null

  return (
    <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Vista previa del flujo
        </span>
      </div>

      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {/* Patient's last message */}
        <div className="flex justify-end">
          <div className="bg-teal-500 text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md max-w-[75%]">
            Quisiera una cita para revisar mi rodilla
          </div>
        </div>

        {/* Bot response */}
        <div className="flex justify-start gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/50 mt-1 shrink-0">
            <Bot className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="bg-muted text-foreground text-[12px] px-3 py-2 rounded-2xl rounded-bl-md max-w-[75%]">
            Claro, con gusto le ayudo. ¿Qué día le quedaría bien?
          </div>
        </div>

        {/* Silence indicator */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
          <span className="text-[10px] text-muted-foreground/50 italic whitespace-nowrap">paciente no responde...</span>
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        </div>

        {/* Follow-up steps */}
        {pasosActivos.map((paso, i) => {
  const preset = getDelayPreset(paso.delay)
          return (
            <motion.div
              key={paso.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="space-y-2"
            >
              {/* Time indicator */}
              <div className="flex items-center gap-1.5 pl-1">
                <Clock className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground/50">+ {preset.label} después</span>
              </div>

              {/* Bot follow-up message */}
              <div className="flex justify-start gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/50 mt-1 shrink-0">
                  <Bot className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="bg-muted text-foreground text-[12px] px-3 py-2 rounded-2xl rounded-bl-md max-w-[75%]">
                  {paso.mensaje}
                </div>
              </div>

              {/* Dashed line between steps */}
              {i < pasosActivos.length - 1 && (
                <div className="flex items-center gap-2 py-0.5">
                  <div className="flex-1 border-t border-dashed border-muted-foreground/15" />
                </div>
              )}
            </motion.div>
          )
        })}

        {/* Final - patient responds */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
          <span className="text-[10px] text-emerald-500/70 italic whitespace-nowrap">✓ paciente responde</span>
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        </div>
        <div className="flex justify-end">
          <div className="bg-teal-500 text-white text-[12px] px-3 py-2 rounded-2xl rounded-br-md max-w-[75%]">
            Sí, puedo el viernes a las 4pm
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step Card ──
function StepCard({
  paso,
  index,
  total,
  onChange,
  onRemove,
}: {
  paso: FollowUpStep
  index: number
  total: number
  onChange: (updated: FollowUpStep) => void
  onRemove: () => void
}) {
  const preset = getDelayPreset(paso.delay)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative">
      {/* Connector line */}
      {index > 0 && (
        <div className="absolute -top-4 left-5 w-px h-4 bg-gradient-to-b from-transparent to-border/60" />
      )}

      <motion.div
        layout
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`relative rounded-xl border transition-all duration-200 ${
          paso.activo
            ? 'border-teal-200 dark:border-teal-800/50 bg-teal-500/[0.03]'
            : 'border-border/30 bg-muted/20 opacity-60'
        }`}
      >
        {/* Step header */}
        <div className="flex items-center gap-3 p-3">
          {/* Step number */}
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${
            paso.activo
              ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-500/20'
              : 'bg-muted text-muted-foreground'
          }`}>
            {index + 1}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Seguimiento #{index + 1}</span>
              <Badge variant="secondary" className="text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <Timer className="h-2.5 w-2.5 mr-0.5" />
                {preset.label}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {paso.mensaje.substring(0, 60)}{paso.mensaje.length > 60 ? '...' : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onChange({ ...paso, activo: !paso.activo })}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title={paso.activo ? 'Desactivar' : 'Activar'}
            >
              {paso.activo ? (
                <ToggleRight className="h-5 w-5 text-teal-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {total > 1 && (
              <button
                onClick={onRemove}
                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-500 transition-colors"
                title="Eliminar paso"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded editor */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/30 p-3 space-y-3">
                {/* Delay selector */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">
                    <Timer className="h-3 w-3 inline mr-1" />
                    Tiempo de espera antes de enviar
                  </Label>
                  <Select
                    value={String(paso.delay)}
                    onValueChange={(v) => {
                      const val = Number(v)
                      const p = DELAY_PRESETS.find(d => d.value === val)
                      onChange({ ...paso, delay: val, delayLabel: p?.label || `${val} min` })
                    }}
                  >
                    <SelectTrigger className="text-xs h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELAY_PRESETS.map(p => (
                        <SelectItem key={p.value} value={String(p.value)} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message editor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-medium">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      Mensaje de seguimiento
                    </Label>
                    <button
                      onClick={() => onChange({ ...paso, mensaje: DEFAULT_MESSAGES[index + 1] || DEFAULT_MESSAGES[3] || paso.mensaje })}
                      className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-medium"
                    >
                      Restablecer default
                    </button>
                  </div>
                  <Textarea
                    value={paso.mensaje}
                    onChange={(e) => onChange({ ...paso, mensaje: e.target.value })}
                    className="text-xs min-h-[70px] rounded-xl resize-none"
                    placeholder="Escribe el mensaje que enviará el bot..."
                  />
                  <p className="text-[10px] text-muted-foreground/50">
                    Puedes usar emojis para darle un tono amigable sin ser invasivo.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Main Component ──
export function FollowUpConfig() {
  // La configuración se carga del servidor (bot/config/seguimiento.json) y el
  // bot la aplica en su próximo ciclo (cada 60 s), sin reiniciar.
  const { data: cargada, loading, refetch } = useApiData<FollowUpConfig>('/api/seguimiento', 0)
  const [config, setConfig] = useState<FollowUpConfig | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (cargada) setConfig(cargada)
  }, [cargada])

  const guardar = async () => {
    if (!config) return
    setGuardando(true)
    try {
      await fetchApi('/api/seguimiento', { method: 'PUT', body: JSON.stringify(config) })
      toast.success('Seguimiento guardado: el bot lo aplica en el próximo minuto')
    } catch {
      toast.error('No se pudo guardar el seguimiento')
    } finally {
      setGuardando(false)
    }
  }

  const updateStep = useCallback((stepId: string, updated: FollowUpStep) => {
    setConfig(prev => prev ? ({
      ...prev,
      pasos: prev.pasos.map(p => p.id === stepId ? updated : p),
    }) : prev)
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setConfig(prev => prev ? ({
      ...prev,
      pasos: prev.pasos.filter(p => p.id !== stepId),
    }) : prev)
    toast.success('Paso eliminado (guarda para aplicar)')
  }, [])

  const addStep = useCallback(() => {
    setConfig(prev => {
      if (!prev) return prev
      const newIdx = prev.pasos.length + 1
      return {
        ...prev,
        pasos: [
          ...prev.pasos,
          {
            id: `step-${Date.now()}`,
            activo: true,
            delay: 1440 * newIdx,
            delayLabel: `${newIdx} días`,
            mensaje: DEFAULT_MESSAGES[3] || '¿Aún necesita ayuda con su cita? Estoy disponible cuando guste. 😊',
          },
        ],
      }
    })
    toast.success('Nuevo paso agregado (guarda para aplicar)')
  }, [])

  if (loading || !config) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-muted border-t-teal-500 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const pasosActivos = config.pasos.filter(p => p.activo).length
  const lastDelay = config.pasos.filter(p => p.activo).sort((a, b) => b.delay - a.delay)[0]
  const lastPreset = lastDelay ? getDelayPreset(lastDelay.delay) : null

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/30">
              <Bot className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Seguimiento Automático</CardTitle>
              <CardDescription className="text-[11px]">
                El bot vuelve a preguntar sin incomodar cuando no hay respuesta
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {config.activo && lastPreset && (
              <Badge variant="secondary" className="text-[10px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                <Timer className="h-2.5 w-2.5 mr-1" />
                Hasta {lastPreset.label} de silencio
              </Badge>
            )}
            <Button
              size="sm"
              className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-teal-500 to-teal-600"
              onClick={guardar}
              disabled={guardando}
            >
              <Save className="h-3.5 w-3.5" /> {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
            <Switch
              checked={config.activo}
              onCheckedChange={(v) => setConfig(prev => prev ? ({ ...prev, activo: v }) : prev)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <AnimatePresence mode="wait">
          {config.activo ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Summary bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Pasos activos:</span>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{pasosActivos}</span>
                    <span className="text-[11px] text-muted-foreground">/ {config.pasos.length}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Máx. reintentos:</span>
                    <Select
                      value={String(config.maxReintentos)}
                      onValueChange={(v) => setConfig(prev => prev ? ({ ...prev, maxReintentos: Number(v) }) : prev)}
                    >
                      <SelectTrigger className="h-7 w-16 text-[11px] rounded-lg px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)} className="text-[11px]">{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                    showPreview
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  {showPreview ? 'Ocultar vista previa' : 'Vista previa'}
                </button>
              </div>

              {/* Night pause */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/50">
                    <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Pausa nocturna</p>
                    <p className="text-[11px] text-muted-foreground">No enviar seguimientos fuera de horario</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {config.pausaNocturna && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={config.horaInicio}
                        onChange={(e) => setConfig(prev => prev ? ({ ...prev, horaInicio: e.target.value }) : prev)}
                        className="h-7 w-24 text-[11px] rounded-lg"
                      />
                      <span className="text-[10px] text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={config.horaFin}
                        onChange={(e) => setConfig(prev => prev ? ({ ...prev, horaFin: e.target.value }) : prev)}
                        className="h-7 w-24 text-[11px] rounded-lg"
                      />
                    </div>
                  )}
                  <Switch
                    checked={config.pausaNocturna}
                    onCheckedChange={(v) => setConfig(prev => prev ? ({ ...prev, pausaNocturna: v }) : prev)}
                  />
                </div>
              </div>

              {/* Preview */}
              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ConversationPreview pasos={config.pasos} nombre="Paciente" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Steps timeline */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 px-1">
                  <Send className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Secuencia de seguimiento
                  </span>
                </div>

                <AnimatePresence>
                  {config.pasos.map((paso, i) => (
                    <StepCard
                      key={paso.id}
                      paso={paso}
                      index={i}
                      total={config.pasos.length}
                      onChange={(updated) => updateStep(paso.id, updated)}
                      onRemove={() => removeStep(paso.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Add step */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={addStep}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 hover:border-teal-300 dark:hover:border-teal-700/50 hover:bg-teal-500/[0.03] p-3 transition-all duration-200"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Agregar otro seguimiento
                </span>
              </motion.button>

              {/* Info tip */}
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    Recomendación
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                    Usa 2-3 seguimientos con intervalos crecientes (ej: 2h, 1 día, 3 días). Mensajes cortos y amigables generan mejor respuesta sin sentirse invasivos. Evita más de 4 seguimientos.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="inactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Bot className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Seguimiento automático desactivado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Activa el switch para configurar cuándo el bot vuelve a preguntar
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
