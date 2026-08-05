// POST /api/auth/login — valida la contraseña del panel en el SERVIDOR y
// devuelve el token de sesión. La contraseña vive en el .env del servidor
// (DASHBOARD_PASSWORD), nunca en el código del cliente.
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let password = ''
  try {
    const body = await request.json()
    password = String(body?.password || '')
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const esperada = process.env.DASHBOARD_PASSWORD || ''
  const token = process.env.DASHBOARD_TOKEN || ''
  if (!esperada || !token) {
    return NextResponse.json({ error: 'El panel no está configurado en el servidor' }, { status: 500 })
  }

  // Comparación en tiempo constante para no filtrar la contraseña por timing.
  const a = Buffer.from(password.padEnd(64).slice(0, 64))
  const b = Buffer.from(esperada.padEnd(64).slice(0, 64))
  if (!crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  return NextResponse.json({ token })
}
