'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboard-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { LoginScreen } from '@/components/dashboard/login-screen'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { ConversationsView } from '@/components/dashboard/conversations-view'
import { AppointmentsView } from '@/components/dashboard/appointments-view'
import { LeadsView } from '@/components/dashboard/leads-view'
import { AnalyticsView } from '@/components/dashboard/analytics-view'
import { ConfigView } from '@/components/dashboard/config-view'

export default function Home() {
  const { vistaActual, sidebarAbierto, autenticado, checkAuth, setSidebarAbierto, setVista, setConversacionSeleccionada } = useDashboardStore()
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    checkAuth()
    setMounted(true)
  }, [])

  // Al abrir el panel desde una notificación push (/?chat=<telefono>) se entra
  // directo a la conversación del paciente que escribió.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const chat = params.get('chat')
    if (chat) {
      setVista('conversaciones')
      setConversacionSeleccionada(chat)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [setVista, setConversacionSeleccionada])

  // En móvil el sidebar funciona como drawer: se cierra al entrar al breakpoint móvil.
  useEffect(() => {
    if (isMobile) setSidebarAbierto(false)
  }, [isMobile, setSidebarAbierto])

  if (!mounted) return <div className="min-h-screen" />

  if (!autenticado) return <LoginScreen />

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <motion.main
        className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300"
        animate={{ marginLeft: isMobile ? 0 : sidebarAbierto ? 260 : 72 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Header />
        <div className="flex-1 p-4 md:p-6">
          <motion.div
            key={vistaActual}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {vistaActual === 'dashboard' && <DashboardView />}
            {vistaActual === 'conversaciones' && <ConversationsView />}
            {vistaActual === 'citas' && <AppointmentsView />}
            {vistaActual === 'leads' && <LeadsView />}
            {vistaActual === 'analiticas' && <AnalyticsView />}
            {vistaActual === 'configuracion' && <ConfigView />}
          </motion.div>
        </div>
        <footer className="mt-auto border-t border-border/50 px-4 md:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Centro de Fisioterapia y Rehabilitación · Cajamarca, Perú
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
                Sistema operativo
              </span>
              <span>·</span>
              <span>Panel Premium v2.0</span>
            </div>
          </div>
        </footer>
      </motion.main>
    </div>
  )
}