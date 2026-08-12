'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, RotateCcw, Building2, Clock, CreditCard, Megaphone, Bot, MessageCircle } from 'lucide-react'
import { SlotManager } from './slot-manager'
import { DiasCerrados } from './dias-cerrados'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { fetchApi, useApiData } from '@/lib/api'
import type { ClinicaConfig } from '@/lib/types'
import { FollowUpConfig } from './followup-config'
import { toast } from 'sonner'

export function ConfigView() {
  const { data: configCargada, loading, refetch } = useApiData<ClinicaConfig>('/api/config', 0)
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [saving, setSaving] = useState(false)

  // Cuando llega la config del servidor se copia al estado editable.
  useEffect(() => {
    if (configCargada) setConfig(configCargada)
  }, [configCargada])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetchApi('/api/config', { method: 'PUT', body: JSON.stringify(config) })
      toast.success('Configuración guardada correctamente')
    } catch {
      toast.error('No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleRestaurar = () => {
    setConfig(null)
    refetch()
    toast.info('Configuración recargada desde el servidor')
  }

  const updateIdentidad = (key: string, value: string | boolean) => {
    setConfig(prev => prev ? ({
      ...prev,
      identidad: { ...prev.identidad, [key]: value },
    }) : prev)
  }

  const updateHorario = (key: string, value: string) => {
    setConfig(prev => prev ? ({
      ...prev,
      horarioGeneral: { ...(prev.horarioGeneral ?? {}), [key]: value },
    }) : prev)
  }

  const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
  const diasLabel: Record<string, string> = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
    viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-teal-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Los cambios se guardan en <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">config/clinica.json</code> y aplican en caliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={handleRestaurar}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
          </Button>
          <Button
            size="sm"
            className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-teal-500 to-teal-600"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </motion.div>

      {/* Identity section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/30">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Identidad del Consultorio</CardTitle>
                <CardDescription className="text-[11px]">Información básica que el agente usa para presentarse</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Médico</Label>
                <Input
                  value={config.identidad.medico}
                  onChange={(e) => updateIdentidad('medico', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidad</Label>
                <Input
                  value={config.identidad.especialidad}
                  onChange={(e) => updateIdentidad('especialidad', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ciudad</Label>
                <Input
                  value={config.identidad.ciudad}
                  onChange={(e) => updateIdentidad('ciudad', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dirección</Label>
                <Input
                  value={config.identidad.direccion}
                  onChange={(e) => updateIdentidad('direccion', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio consulta</Label>
                <Input
                  value={config.identidad.precioConsulta}
                  onChange={(e) => updateIdentidad('precioConsulta', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio sesión individual</Label>
                <Input
                  value={config.identidad.precioSesion ?? ''}
                  onChange={(e) => updateIdentidad('precioSesion', e.target.value)}
                  placeholder="S/ 40"
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Paquete 10 sesiones</Label>
                <Input
                  value={config.identidad.paquete10Sesiones ?? ''}
                  onChange={(e) => updateIdentidad('paquete10Sesiones', e.target.value)}
                  placeholder="S/ 350"
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duración consulta</Label>
                <Input
                  value={config.identidad.duracionConsulta}
                  onChange={(e) => updateIdentidad('duracionConsulta', e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Saludo inicial</Label>
              <Textarea
                value={config.identidad.saludo}
                onChange={(e) => updateIdentidad('saludo', e.target.value)}
                className="text-xs min-h-[80px] rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
              <div>
                <p className="text-xs font-medium">Consulta virtual</p>
                <p className="text-[11px] text-muted-foreground">Habilitar modalidad de atención virtual</p>
              </div>
              <Switch
                checked={config.identidad.consultaVirtualHabilitada}
                onCheckedChange={(v) => updateIdentidad('consultaVirtualHabilitada', v)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Schedule section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Horario General</CardTitle>
                <CardDescription className="text-[11px]">Horario de atención por día de la semana</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {diasSemana.map((dia) => (
                <div key={dia} className="flex items-center gap-3 rounded-xl border border-border/30 p-3">
                  <span className={`text-xs font-semibold w-20 ${config.horarioGeneral?.[dia] === 'no disponible' ? 'text-muted-foreground' : ''}`}>
                    {diasLabel[dia]}
                  </span>
                  <Input
                    value={config.horarioGeneral?.[dia] || ''}
                    onChange={(e) => updateHorario(dia, e.target.value)}
                    className="text-[11px] h-8 rounded-lg flex-1"
                    placeholder="ej: 4:00 p. m. a 7:00 p. m."
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Días cerrados */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <DiasCerrados
          dias={config.agenda?.diasCerrados ?? []}
          onChange={(nuevos) =>
            setConfig(prev => prev ? ({
              ...prev,
              agenda: { ...(prev.agenda ?? {}), diasCerrados: nuevos },
            }) : prev)
          }
        />
      </motion.div>

      {/* Slot Manager - Interactive */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <SlotManager />
      </motion.div>

      {/* Follow-up config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <FollowUpConfig />
      </motion.div>

      {/* Payment methods */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Medios de Pago</CardTitle>
                <CardDescription className="text-[11px]">Formas de pago aceptadas en el consultorio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {config.mediosDePago.map((medio, i) => (
                <Badge key={i} variant="secondary" className="text-xs px-3 py-1.5 gap-1.5">
                  💳 {medio}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Campaigns */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/30">
                <Megaphone className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Campañas Activas</CardTitle>
                <CardDescription className="text-[11px]">Promociones y campañas especiales del consultorio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {config.campaniasActivas.map((campania, i) => (
              <div key={i} className="rounded-xl border border-border/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{campania.nombre}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-semibold ${
                      campania.estado === 'ACTIVA'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {campania.estado}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{campania.instrucciones}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}