// ============================================================
// Acceso a los datos del bot de WhatsApp (bot/data/*.json y
// bot/config/clinica.json). Solo se usa desde API routes (Node).
// Los archivos se leen frescos en cada request; si no existen o
// están corruptos se devuelve el valor por defecto (nunca 500).
// ============================================================
import fs from 'fs'
import path from 'path'

// El dashboard en producción corre desde .next/standalone (Next cambia el cwd
// del proceso y además copia una INSTANTÁNEA de bot/ dentro de standalone en
// cada build). Por eso se busca hacia arriba y se toma la coincidencia MÁS
// EXTERNA: la real está en la raíz del proyecto, no en .next/standalone.
// La variable de entorno BOT_DIR, si existe, tiene prioridad.
function resolverBotDir(): string {
  if (process.env.BOT_DIR) return path.resolve(process.env.BOT_DIR)
  let dir = process.cwd()
  let encontrado: string | null = null
  for (let i = 0; i < 6; i++) {
    const candidato = path.join(dir, 'bot')
    if (fs.existsSync(path.join(candidato, 'config', 'clinica.json'))) encontrado = candidato
    const padre = path.dirname(dir)
    if (padre === dir) break
    dir = padre
  }
  return encontrado ?? path.join(process.cwd(), 'bot')
}

const BOT_DIR = resolverBotDir()

export const botPaths = {
  conversaciones: path.join(BOT_DIR, 'data', 'conversaciones.json'),
  citas: path.join(BOT_DIR, 'data', 'citas.json'),
  leads: path.join(BOT_DIR, 'data', 'leads.json'),
  derivaciones: path.join(BOT_DIR, 'data', 'derivaciones.json'),
  clinicaConfig: path.join(BOT_DIR, 'config', 'clinica.json'),
  seguimientoConfig: path.join(BOT_DIR, 'config', 'seguimiento.json'),
}

// Lee un JSON del disco; ante cualquier error devuelve el default.
export function leerJson<T>(archivo: string, valorInicial: T): T {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8')) as T
  } catch {
    return valorInicial
  }
}

// Escritura atómica: tmp + rename (igual que hace el bot en store.js).
export function escribirJson(archivo: string, datos: unknown): void {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8')
  fs.renameSync(tmp, archivo)
}
