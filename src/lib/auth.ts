'use client'

// Token de sesión del panel: lo emite el servidor tras validar la contraseña
// (POST /api/auth/login) y viaja en cada llamada a la API. La contraseña ya
// NO está en el código del cliente.
const TOKEN_KEY = 'agente_admin_token'

export function obtenerToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function guardarToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function borrarToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// fetch con el token del panel; si el servidor responde 401 (token viejo o
// ausente), limpia la sesión para que vuelva a pedir contraseña.
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {})
  const token = obtenerToken()
  if (token) headers.set('x-panel-token', token)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401 && !url.startsWith('/api/auth')) {
    borrarToken()
    localStorage.removeItem('agente_admin_auth')
    window.location.reload()
  }
  return res
}
