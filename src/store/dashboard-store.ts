import { create } from 'zustand'
import { guardarToken, borrarToken, obtenerToken } from '@/lib/auth'

export type Vista = 'dashboard' | 'conversaciones' | 'citas' | 'leads' | 'configuracion' | 'analiticas'

interface DashboardState {
  vistaActual: Vista
  sidebarAbierto: boolean
  conversacionSeleccionada: string | null
  autenticado: boolean
  setVista: (vista: Vista) => void
  setSidebarAbierto: (abierto: boolean) => void
  setConversacionSeleccionada: (telefono: string | null) => void
  login: (password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  vistaActual: 'dashboard',
  // En móvil el sidebar es un drawer y arranca cerrado; en desktop arranca expandido.
  sidebarAbierto: typeof window === 'undefined' ? true : window.innerWidth >= 768,
  conversacionSeleccionada: null,
  autenticado: false,
  setVista: (vista) => set({ vistaActual: vista }),
  setSidebarAbierto: (abierto) => set({ sidebarAbierto: abierto }),
  setConversacionSeleccionada: (telefono) => set({ conversacionSeleccionada: telefono }),
  // La contraseña se valida en el SERVIDOR; aquí solo se guarda el token que emite.
  login: async (password) => {
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!r.ok) return false
      const { token } = await r.json()
      if (!token) return false
      guardarToken(token)
      localStorage.setItem('agente_admin_auth', '1')
      set({ autenticado: true })
      return true
    } catch {
      return false
    }
  },
  logout: () => {
    borrarToken()
    localStorage.removeItem('agente_admin_auth')
    set({ autenticado: false, vistaActual: 'dashboard', conversacionSeleccionada: null })
  },
  checkAuth: () => {
    if (localStorage.getItem('agente_admin_auth') === '1' && obtenerToken()) {
      set({ autenticado: true })
    }
  },
}))
