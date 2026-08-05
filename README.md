# Agente Consultorio — Dr. Michael Vásquez

Sistema completo del agente de WhatsApp del consultorio de Ortopedia y Traumatología del Dr. Michael Vásquez (Cajamarca, Perú). El repo tiene dos componentes:

## 1. Dashboard (raíz) — Next.js 16 + Tailwind + shadcn/ui

Panel de administración premium con vistas de Dashboard, Conversaciones, Citas, Leads, Analíticas y Configuración (incluye gestor de horarios y seguimiento automático).

```bash
npm install
npm run dev      # http://localhost:3000 (desarrollo; en producción corre en el 3010)
```

## 2. Bot de WhatsApp (`bot/`) — Express + OpenAI + Meta Cloud API

El agente que atiende pacientes por WhatsApp: calificación, agenda, derivación a recepción y protocolo de urgencias. Corre como proceso aparte, en el **puerto 3101**.

```bash
cp bot/.env.example bot/.env   # completa las variables (OpenAI, Meta, recepción)
npm run bot                    # producción
npm run bot:dev                # desarrollo con --watch
npm test                       # pruebas unitarias del bot
npm run simular                # simulación de conversaciones sin Meta
```

Documentación completa del bot (configuración de Meta, comandos de recepción `#confirmar`/`#tomar`/`#soltar`/`#decir`, modo de agenda): **[bot/README.md](bot/README.md)**.

- Datos editables del consultorio (horarios, cupos, precios, pagos): `bot/config/clinica.json`
- Prompt maestro del agente: `bot/prompts/system-prompt.md`
- Persistencia en JSON (conversaciones, citas, leads): `bot/data/` (no se versiona)

## Despliegue

El `Caddyfile` enruta el tráfico así:

| Ruta | Destino |
|---|---|
| `/webhook`, `/health`, `/admin`, `/chat/*` | Bot Express (`localhost:3101`) |
| resto | Dashboard Next.js (`localhost:3010`) |

En producción el enrutamiento lo hace **nginx** (`asistente.kaminar.pe`); el `Caddyfile` aplica solo al entorno de preview. Ojo: el puerto 3000 del servidor pertenece a KaminarMed (kaminar.pe) — el dashboard de este proyecto usa el 3010.

En Meta for Developers, configura el webhook como `https://tu-dominio/webhook` con el mismo `WEBHOOK_VERIFY_TOKEN` del `bot/.env`. Ambos procesos (dashboard y bot) deben estar corriendo en el servidor.
