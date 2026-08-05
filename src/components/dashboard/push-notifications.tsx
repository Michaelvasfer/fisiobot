'use client'
import { authFetch } from '@/lib/auth'

// Botón de la campanita: registra el service worker del panel y permite
// activar/desactivar las notificaciones push en este dispositivo.
// El bot envía un aviso a cada dispositivo suscrito cuando llega un mensaje nuevo.
import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

type Estado = 'cargando' | 'activo' | 'inactivo' | 'bloqueado' | 'no-soportado'

function base64AUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function PushNotifications() {
  const [estado, setEstado] = useState<Estado>('cargando')

  const obtenerSuscripcion = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
    // getRegistration no cuelga: si el SW no está activo devuelve undefined.
    const reg = await navigator.serviceWorker.getRegistration('/')
    return reg ? reg.pushManager.getSubscription() : null
  }, [])

  const refrescar = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('no-soportado')
      return
    }
    if (Notification.permission === 'denied') {
      setEstado('bloqueado')
      return
    }
    const sus = await obtenerSuscripcion().catch(() => null)
    setEstado(sus ? 'activo' : 'inactivo')
  }, [obtenerSuscripcion])

  useEffect(() => {
    // Registrar el SW al abrir el panel: lo necesitan tanto las notificaciones
    // push como la instalación de la app (PWA) en PC y celular.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(refrescar).catch(() => setEstado('no-soportado'))
    } else {
      setEstado('no-soportado')
    }
  }, [refrescar])

  const alternar = async () => {
    try {
      const actual = await obtenerSuscripcion()
      if (actual) {
        await authFetch('/api/push/desuscribir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: actual.endpoint }),
        })
        await actual.unsubscribe()
        setEstado('inactivo')
        toast.success('Avisos desactivados en este dispositivo')
        return
      }
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        refrescar()
        return
      }
      const respClave = await authFetch('/api/push/clave-publica')
      if (!respClave.ok) throw new Error('clave pública: el servidor respondió ' + respClave.status)
      const { clave } = await respClave.json()
      if (!clave) {
        toast.error('El servidor no tiene configuradas las claves push')
        return
      }
      // Registra el SW si aún no existe; nunca esperar a "ready" (puede no resolverse nunca).
      let reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
      const sus = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64AUint8(clave) })
      const respSus = await authFetch('/api/push/suscribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sus),
      })
      if (!respSus.ok) throw new Error('registro en el servidor: respondió ' + respSus.status)
      setEstado('activo')
      toast.success('Listo: recibirás un aviso cuando llegue un mensaje nuevo al bot')
    } catch (err) {
      console.error(err)
      toast.error('No se pudieron activar las notificaciones: ' + (err instanceof Error ? err.message : 'error desconocido'))
      refrescar()
    }
  }

  const config: Record<Estado, { titulo: string; Icono: typeof Bell; clase: string }> = {
    cargando: { titulo: 'Notificaciones', Icono: Bell, clase: 'text-slate-500' },
    activo: { titulo: 'Avisos activos en este dispositivo (clic para desactivar)', Icono: BellRing, clase: 'text-teal-500' },
    inactivo: { titulo: 'Activar avisos de mensajes nuevos', Icono: Bell, clase: 'text-slate-500' },
    bloqueado: { titulo: 'Notificaciones bloqueadas en el navegador', Icono: BellOff, clase: 'text-rose-500' },
    'no-soportado': { titulo: 'Este navegador no soporta notificaciones push', Icono: BellOff, clase: 'text-slate-400' },
  }
  const { titulo, Icono, clase } = config[estado]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl relative"
          onClick={alternar}
          disabled={estado === 'bloqueado' || estado === 'no-soportado'}
        >
          <Icono className={`h-4 w-4 ${clase}`} />
          {estado === 'activo' && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-teal-500 border border-background" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{titulo}</TooltipContent>
    </Tooltip>
  )
}
