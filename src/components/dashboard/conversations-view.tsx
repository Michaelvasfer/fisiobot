'use client'
import { authFetch } from '@/lib/auth'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Phone, UserCircle, ArrowRight, Send, Lock, Unlock,
  AlertTriangle, RefreshCw, MessageSquare, ChevronLeft
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useDashboardStore } from '@/store/dashboard-store'
import { toast } from 'sonner'

interface BotConversation {
  telefono: string
  nombre: string | null
  interes: string | null
  motivo: string | null
  citaPendiente: boolean
  citaConfirmada: boolean
  estado: string
  handoff: boolean
  campania: string | null
  totalMensajes: number
  ultimoMensaje: string
  ultimoRol: string | null
  ultimaActividad: string | null
}

interface ChatMessage {
  role: string
  content: string
  ts?: string
  manual?: boolean
}

interface FullConversation {
  historial: ChatMessage[]
  estado: string
  handoff: boolean
  campania: string | null
}

// El contenido sin texto (audio, imagen, sticker...) se guarda como nota
// "[Sistema: ...]" con el cuerpo vacío; se muestra una etiqueta legible en vez
// de la nota cruda o una burbuja en blanco. La nota completa va en el tooltip.
function textoVisible(contenido: string): { texto: string; detalle: string | null } {
  const crudo = contenido || ''
  if (!crudo.startsWith('[Sistema:')) return { texto: crudo, detalle: null }
  const m = /^\[Sistema: ([\s\S]*?)\]\n\n/.exec(crudo)
  const nota = m ? m[1] : crudo.replace(/^\[Sistema: ?/, '').replace(/\]\s*$/, '')
  const resto = m ? crudo.slice(m[0].length).trim() : ''
  if (resto) return { texto: resto, detalle: nota }
  let etiqueta = '📎 Contenido no textual'
  if (/audio|nota de voz/i.test(nota)) etiqueta = '🎙️ Audio'
  else if (/imagen/i.test(nota)) etiqueta = '🖼️ Imagen'
  else if (/documento/i.test(nota)) etiqueta = '📄 Documento'
  else if (/video/i.test(nota)) etiqueta = '🎥 Video'
  else if (/sticker/i.test(nota)) etiqueta = 'Sticker'
  else if (/ubicaci/i.test(nota)) etiqueta = '📍 Ubicación'
  const tipo = /\(tipo: ([^)]+)\)/.exec(nota)
  if (tipo) etiqueta += ` (tipo: ${tipo[1]})`
  return { texto: etiqueta, detalle: nota }
}

const estadoConfig: Record<string, { color: string; label: string }> = {
  NUEVO: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'Nuevo' },
  CALIFICANDO: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', label: 'Calificando' },
  CONSULTANDO_DISPONIBILIDAD: { color: 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400', label: 'Consultando' },
  CITA_SOLICITADA: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', label: 'Cita solicitada' },
  CITA_CONFIRMADA: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', label: 'Confirmada' },
  PENDIENTE_CONFIRMACION: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', label: 'Pendiente' },
  DERIVADO_A_RECEPCION: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', label: 'Derivado' },
  COMPLETADO: { color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400', label: 'Completado' },
}

const interesConfig: Record<string, { color: string; label: string }> = {
  INTERES_ALTO: { color: 'bg-emerald-500', label: 'Alto' },
  INTERES_MEDIO: { color: 'bg-amber-500', label: 'Medio' },
  INTERES_BAJO: { color: 'bg-slate-400', label: 'Bajo' },
  CASO_RECONSTRUCTIVO: { color: 'bg-rose-500', label: 'Reconstructivo' },
  PACIENTE_OPERADO: { color: 'bg-purple-500', label: 'Operado' },
}

function formatFechaHora(iso: string) {
  try {
    const d = new Date(iso)
    const ahora = new Date()
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    if (dia.getTime() === hoy.getTime()) return `hoy ${hora}`
    if (dia.getTime() === hoy.getTime() - 86400000) return `ayer ${hora}`
    return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} ${hora}`
  } catch { return '' }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

export function ConversationsView() {
  const { conversacionSeleccionada, setConversacionSeleccionada } = useDashboardStore()
  const [conversaciones, setConversaciones] = useState<BotConversation[]>([])
  const [chatData, setChatData] = useState<FullConversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [mensajeManual, setMensajeManual] = useState('')
  const [filter, setFilter] = useState('todos')
  // En móvil, si ya hay una conversación seleccionada (p. ej. al llegar desde
  // una notificación push), se muestra el chat directo en vez de la lista.
  const [mobileShowChat, setMobileShowChat] = useState(() => Boolean(useDashboardStore.getState().conversacionSeleccionada))
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchConversaciones = useCallback(async () => {
    try {
      const r = await authFetch('/api/bot/conversations')
      if (r.ok) {
        const data = await r.json()
        setConversaciones(Array.isArray(data) ? data : [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  const fetchChat = useCallback(async (telefono: string, silencioso = false) => {
    if (!silencioso) setChatLoading(true)
    try {
      const r = await authFetch(`/api/bot/conversations/${telefono}`)
      if (r.ok) {
        const data = await r.json()
        setChatData(data)
      }
    } catch { /* silent */ }
    if (!silencioso) setChatLoading(false)
  }, [])

  useEffect(() => {
    fetchConversaciones()
    const interval = setInterval(fetchConversaciones, 10000)
    return () => clearInterval(interval)
  }, [fetchConversaciones])

  useEffect(() => {
    if (!conversacionSeleccionada) {
      setChatData(null)
      return
    }
    fetchChat(conversacionSeleccionada)
    // Polling del chat abierto: los mensajes nuevos del paciente aparecen solos,
    // sin tener que salir y volver a entrar a la conversación.
    const interval = setInterval(() => fetchChat(conversacionSeleccionada, true), 5000)
    return () => clearInterval(interval)
  }, [conversacionSeleccionada, fetchChat])

  useEffect(() => {
    if (chatData?.historial && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [chatData?.historial?.length])

  const handleSelect = (telefono: string) => {
    setConversacionSeleccionada(telefono)
    setMobileShowChat(true)
  }

  const handleSend = async () => {
    if (!mensajeManual.trim() || !conversacionSeleccionada || sending) return
    setSending(true)
    try {
      const r = await authFetch(`/api/bot/conversations/${conversacionSeleccionada}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: mensajeManual.trim() }),
      })
      if (r.ok) {
        setMensajeManual('')
        fetchChat(conversacionSeleccionada)
        fetchConversaciones()
        toast.success('Mensaje enviado')
      } else {
        toast.error('Error al enviar')
      }
    } catch {
      toast.error('Error de conexión')
    }
    setSending(false)
  }

  const handleHandoff = async (activo: boolean) => {
    if (!conversacionSeleccionada) return
    try {
      const r = await authFetch(`/api/bot/conversations/${conversacionSeleccionada}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'handoff', activo }),
      })
      if (r.ok) {
        fetchConversaciones()
        fetchChat(conversacionSeleccionada)
        toast.success(activo ? 'Conversación tomada por recepción' : 'Agente reanudado')
      }
    } catch {
      toast.error('Error')
    }
  }

  const filtered = conversaciones.filter(c => {
    const matchesSearch = !search ||
      (c.nombre && c.nombre.toLowerCase().includes(search.toLowerCase())) ||
      c.telefono.includes(search)
    const matchesFilter = filter === 'todos' ||
      (filter === 'activos' && c.estado !== 'COMPLETADO' && c.estado !== 'CITA_CANCELADA') ||
      (filter === 'handoff' && c.handoff) ||
      (filter === 'pendientes' && c.citaPendiente)
    return matchesSearch && matchesFilter
  })

  const selectedConv = conversaciones.find(c => c.telefono === conversacionSeleccionada)

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'activos', label: 'Activos' },
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'handoff', label: 'Handoff' },
  ]

  return (
    <div className="flex gap-4 h-[calc(100vh-7.5rem)]">
      {/* Contact list */}
      <motion.div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}
        layout
      >
        <div className="p-3 space-y-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                className="h-9 pl-9 rounded-xl text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-xl" onClick={() => { fetchConversaciones(); toast.info('Actualizando...') }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex gap-1.5">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all ${
                  filter === f.id
                    ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >{f.label}</button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Sin conversaciones</p>
              </div>
            ) : filtered.map((conv, i) => {
              const est = estadoConfig[conv.estado] || estadoConfig.NUEVO
              const isSelected = conv.telefono === conversacionSeleccionada
              const intCfg = conv.interes ? interesConfig[conv.interes] : null
              return (
                <motion.button
                  key={conv.telefono}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleSelect(conv.telefono)}
                  className={`w-full flex items-start gap-3 p-3 text-left transition-colors border-b border-border/30 ${
                    isSelected
                      ? 'bg-teal-500/5 border-l-2 border-l-teal-500'
                      : 'hover:bg-muted/30 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-xs font-semibold">
                        {(conv.nombre || conv.telefono).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conv.handoff && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
                        <AlertTriangle className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate">
                        {conv.nombre || conv.telefono}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.citaPendiente && (
                          <Badge className="text-[8px] px-1 py-0 h-3.5 bg-amber-500 text-white">Cita</Badge>
                        )}
                        <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${est.color}`}>
                          {est.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {textoVisible(conv.ultimoMensaje).texto || '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {intCfg && (
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${intCfg.color}`} />
                          <span className="text-[10px] text-muted-foreground">{intCfg.label}</span>
                        </span>
                      )}
                      {conv.motivo && (
                        <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">{conv.motivo}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 ml-auto flex-shrink-0">
                        {conv.ultimaActividad ? formatFechaHora(conv.ultimaActividad) : ''}
                      </span>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </ScrollArea>
      </motion.div>

      {/* Chat detail */}
      <AnimatePresence mode="wait">
        {selectedConv ? (
          <motion.div
            key={selectedConv.telefono}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={`flex-1 flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <button className="md:hidden p-1" onClick={() => setMobileShowChat(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-teal-400 to-teal-600 text-white text-xs font-bold">
                    {(selectedConv.nombre || selectedConv.telefono).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedConv.nombre || selectedConv.telefono}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${selectedConv.handoff ? 'bg-amber-500 pulse-dot' : 'bg-emerald-500 pulse-dot'}`} />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {selectedConv.handoff ? 'Atención humana' : 'Agente automático'}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50 hidden lg:inline">· {selectedConv.telefono}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedConv.handoff ? (
                  <Button size="sm" variant="outline" className="h-8 text-[11px] rounded-lg gap-1.5" onClick={() => handleHandoff(false)}>
                    <Unlock className="h-3 w-3" /> Liberar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 text-[11px] rounded-lg gap-1.5" onClick={() => handleHandoff(true)}>
                    <Lock className="h-3 w-3" /> Tomar
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {chatLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : chatData?.historial && chatData.historial.length > 0 ? (
                  chatData.historial.map((msg, i) => {
                    const isUser = msg.role === 'user'
                    const v = textoVisible(msg.content)
                    const prev = chatData.historial[i - 1]
                    const showTime = !prev || !prev.ts || (msg.ts && prev.ts && new Date(msg.ts).getTime() - new Date(prev.ts).getTime() > 300000)
                    return (
                      <div key={i}>
                        {showTime && msg.ts && (
                          <div className="flex justify-center my-3">
                            <span className="text-[10px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-full">
                              {formatDate(msg.ts)} {formatTime(msg.ts)}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-br-md'
                              : 'bg-muted/80 rounded-bl-md'
                          }`} title={v.detalle || undefined}>
                            {v.texto}
                            {msg.manual && (
                              <span className="block text-[9px] mt-1 opacity-60">✍️ enviado manualmente</span>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <UserCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Sin mensajes</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Esta conversación no tiene historial</p>
                  </div>
                )}
              </div>
            </div>

            {/* Manual reply */}
            <div className="border-t border-border/50 p-3">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Input
                  placeholder={`Escribir a ${selectedConv.nombre || 'paciente'}...`}
                  className="rounded-xl text-xs"
                  value={mensajeManual}
                  onChange={(e) => setMensajeManual(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={sending}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex-shrink-0"
                  onClick={handleSend}
                  disabled={sending || !mensajeManual.trim()}
                >
                  {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`flex-1 items-center justify-center rounded-2xl border border-border/50 bg-card/50 ${mobileShowChat ? 'hidden' : 'hidden md:flex'}`}
          >
            <div className="text-center">
              <div className="mx-auto h-20 w-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
                <Phone className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Selecciona una conversación</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Elige un contacto para ver el chat completo</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
