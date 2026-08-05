'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Search, Moon, Sun, LogOut, Settings, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PushNotifications } from './push-notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState } from 'react'

const viewTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Resumen general del consultorio' },
  conversaciones: { title: 'Conversaciones', subtitle: 'Monitoreo en tiempo real de WhatsApp' },
  citas: { title: 'Citas', subtitle: 'Gestión de citas y horarios' },
  leads: { title: 'Leads', subtitle: 'Pacientes potenciales y su nivel de interés' },
  analiticas: { title: 'Analíticas', subtitle: 'Estadísticas detalladas del agente' },
  configuracion: { title: 'Configuración', subtitle: 'Ajustes del agente y del consultorio' },
}

export function Header() {
  const { vistaActual, logout, setVista, setSidebarAbierto } = useDashboardStore()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const current = viewTitles[vistaActual] || viewTitles.dashboard

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Left: hamburger (móvil) + title */}
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl md:hidden"
              onClick={() => setSidebarAbierto(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5 text-slate-500" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                {current.title}
              </h1>
              <p className="hidden sm:block text-[12px] text-muted-foreground mt-0.5 truncate">{current.subtitle}</p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="Buscar paciente, cita..."
                className="h-9 w-64 pl-9 rounded-xl bg-muted/50 border-border/50 text-xs focus:w-80 transition-all duration-300"
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
              />
            </div>

            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cambiar tema</TooltipContent>
            </Tooltip>

            {/* Notifications */}
            {/* Notificaciones push: campanita real (activar/desactivar avisos) */}
            <PushNotifications />

            {/* Profile */}
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 rounded-xl gap-2 px-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-700 text-white text-[11px] font-bold">
                          MV
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium hidden lg:inline">Admin</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="gap-2">
                      <span className="font-medium text-xs">Dr. Michael Vásquez</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2" onSelect={() => setVista('configuracion')}>
                      <Settings className="h-3.5 w-3.5" />
                      <span className="text-xs">Configuración</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-rose-500 hover:text-rose-600 focus:text-rose-600" onSelect={logout}>
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="text-xs">Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>Perfil</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}