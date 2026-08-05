#!/bin/bash
# ============================================================
# DEPLOY - Agente Consultorio Dr. Vásquez (dashboard + bot)
# Lo ejecuta el GitHub Action (.github/workflows/deploy.yml) por SSH,
# o manualmente en el servidor:
#   bash deploy-agenteconsultorio.sh
# ============================================================
set -e

echo "=== Deploy agenteconsultorio ==="

# 1. Ir al directorio del proyecto
PROJECT_DIR="${1:-/root/agenteconsultorio}"
cd "$PROJECT_DIR" 2>/dev/null || {
  echo "❌ No encontré el proyecto en $PROJECT_DIR"
  echo "   Pásalo como argumento: bash deploy-agenteconsultorio.sh /ruta/al/proyecto"
  exit 1
}

# 2. Traer los cambios de GitHub (--autostash preserva cambios locales como .env)
echo "→ Descargando cambios de GitHub..."
git pull --autostash origin main

# 3. Instalar dependencias (legacy-peer-deps: conflicto conocido openai@4 vs zod@4)
echo "→ Instalando dependencias..."
npm install --legacy-peer-deps

# 4. Tests del bot
echo "→ Ejecutando tests del bot..."
npm test

# 5. Build del dashboard Next.js (genera .next/standalone)
echo "→ Compilando dashboard..."
npm run build

# 6. Garantizar que el bot tenga su .env (sin pisar uno existente)
if [ ! -f bot/.env ]; then
  echo "⚠️  bot/.env no existe. Creando desde la plantilla..."
  cp bot/.env.example bot/.env
  echo "   ⚠️  EDITA bot/.env con las credenciales reales (OpenAI, Meta, recepción)"
  echo "   y vuelve a desplegar o reinicia: pm2 restart bot"
fi

# 7. Reiniciar los dos procesos (dashboard :3000 + bot :3001)
echo "→ Reiniciando servicios..."
if command -v pm2 &>/dev/null; then
  pm2 startOrRestart ecosystem.config.cjs
  pm2 save
  echo "   ✅ PM2 reiniciado (dashboard + bot)"
elif command -v systemctl &>/dev/null && systemctl is-enabled agenteconsultorio &>/dev/null; then
  sudo systemctl restart agenteconsultorio
  echo "   ✅ systemd reiniciado"
else
  echo "   ⚠️  No se detectó PM2 ni systemd. Instala PM2: npm i -g pm2"
  echo "   y arranca con: pm2 start ecosystem.config.cjs"
fi

# 8. Recargar Caddy si está instalado (rutas del webhook -> bot)
if command -v caddy &>/dev/null; then
  caddy reload --config "$PROJECT_DIR/Caddyfile" 2>/dev/null \
    && echo "   ✅ Caddy recargado" \
    || echo "   ⚠️  No se pudo recargar Caddy (revísalo manualmente)"
fi

# 9. Verificación
echo "→ Verificando..."
sleep 3
curl -sf http://localhost:3101/health && echo "  ✅ bot OK (:3101)" || echo "  ⚠️  bot no responde en :3101"
curl -sf -o /dev/null http://localhost:3010 && echo "  ✅ dashboard OK (:3010)" || echo "  ⚠️  dashboard no responde en :3010"

echo ""
echo "=== ✅ Deploy completado ==="
