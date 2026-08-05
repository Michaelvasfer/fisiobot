// Protege las API routes del panel: todas las /api/* (menos /api/auth/*)
// exigen el token de sesión que emite POST /api/auth/login.
// Nota: el middleware corre en el edge runtime (sin node:crypto).
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const esperado = process.env.DASHBOARD_TOKEN || ''
  // Si el servidor no tiene token configurado, no bloquear (evita dejar el
  // panel inusable por un despliegue sin .env actualizado).
  if (!esperado) return NextResponse.next()

  const recibido = request.headers.get('x-panel-token') || ''
  if (recibido !== esperado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/((?!auth/).*)'],
}
