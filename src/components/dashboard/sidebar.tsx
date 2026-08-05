'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore, type Vista } from '@/store/dashboard-store'
import { useIsMobile } from '@/hooks/use-mobile'
import Image from 'next/image'
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Users,
  Settings,
  BarChart3,
  ChevronLeft,
  Sparkles,
  X,
} from 'lucide-react'

const navItems: { id: Vista; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { id: 'citas', label: 'Citas', icon: CalendarDays },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'analiticas', label: 'Analíticas', icon: BarChart3 },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const { vistaActual, setVista, sidebarAbierto, setSidebarAbierto } = useDashboardStore()
  const isMobile = useIsMobile()

  return (
    <>
      {/* Backdrop del drawer móvil: clic para cerrar */}
      <AnimatePresence>
        {isMobile && sidebarAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarAbierto(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className="fixed left-0 top-0 z-50 flex h-screen flex-col bg-[#0c1222] text-white"
        animate={
          isMobile
            ? { width: 260, x: sidebarAbierto ? 0 : -260 }
            : { width: sidebarAbierto ? 260 : 72, x: 0 }
        }
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
      {/* Logo area */}
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700">
          <Image
            src="/clinic-logo.png"
            alt="Logo"
            fill
            className="object-cover"
            sizes="36px"
          />
        </div>
        <AnimatePresence>
          {sidebarAbierto && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold leading-tight tracking-tight">Fisioterapia</p>
              <p className="text-[11px] text-white/40 leading-tight">Fisioterapia y Rehabilitación</p>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Botón cerrar del drawer (solo móvil) */}
        <button
          onClick={() => setSidebarAbierto(false)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition-colors md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = vistaActual === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => {
                setVista(item.id)
                // En móvil el drawer se cierra al elegir una vista
                if (isMobile) setSidebarAbierto(false)
              }}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-300'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500/15 to-transparent"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}
              <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-white/40 group-hover:text-white/70'}`} />
              <AnimatePresence>
                {sidebarAbierto && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </nav>

      {/* Premium badge & collapse button */}
      <div className="border-t border-white/[0.06] p-3 space-y-2">
        <AnimatePresence>
          {sidebarAbierto && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl bg-gradient-to-r from-teal-500/10 to-emerald-500/5 border border-teal-500/10 p-3"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-[11px] font-semibold text-teal-300 tracking-wide uppercase">Premium</span>
              </div>
              <p className="text-[10px] text-white/30 mt-1">Panel de administración avanzado</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setSidebarAbierto(!sidebarAbierto)}
          className="hidden md:flex w-full items-center justify-center rounded-xl py-2 text-white/30 hover:bg-white/[0.04] hover:text-white/60 transition-colors"
        >
          <motion.div
            animate={{ rotate: sidebarAbierto ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
      </div>
      </motion.aside>
    </>
  )
}
