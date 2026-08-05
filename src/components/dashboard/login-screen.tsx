'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDashboardStore } from '@/store/dashboard-store'

export function LoginScreen() {
  const { login } = useDashboardStore()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(false)
    setLoading(true)
    const ok = await login(password)
    if (!ok) {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/5 p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Centro de Fisioterapia</h1>
              <p className="text-sm text-muted-foreground mt-1">Panel de Administración</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium">
                <Lock className="h-3 w-3 inline mr-1.5" />
                Contraseña de acceso
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa la contraseña"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false) }}
                  className={`h-11 rounded-xl pr-10 text-sm ${error ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-rose-500 font-medium">
                  Contraseña incorrecta
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!password.trim() || loading}
              className="w-full h-11 rounded-xl text-sm font-medium bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-sm shadow-teal-500/20"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Ingresar
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground/50">
            Acceso restringido al personal autorizado
          </p>
        </div>
      </div>
    </div>
  )
}
